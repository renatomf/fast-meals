import type { OptimizeAssignmentResponse, Order } from "@fastmeals/contracts";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { App } from "../src/app.ts";
import { seedOfficialData } from "../src/db/seed-official.ts";
import { apiClient, tokenFor, type ApiClient } from "./support/api.ts";
import { buildTestApp } from "./support/app.ts";
import { connectTestDatabase } from "./support/database.ts";

const { pool, db } = connectTestDatabase();
let app: App;
let admin: ApiClient;

async function start(demoMode: boolean) {
  app = await buildTestApp({ db, env: { DEMO_MODE: demoMode } });
  admin = apiClient(app, await tokenFor(db, "admin"));
}

beforeEach(async () => {
  await seedOfficialData(db, { reset: true });
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await pool.end();
});

async function demoOrdersReady() {
  const response = await admin.get("/orders?status=ready&limit=100");
  return response
    .json<{ data: Order[] }>()
    .data.filter((order) => order.customerName.startsWith("[Demo]"));
}

describe("POST /api/dispatch/demo-scenario", () => {
  it("does not exist unless DEMO_MODE is on", async () => {
    await start(false);

    expect((await admin.post("/dispatch/demo-scenario", {})).statusCode).toBe(404);
  });

  it("creates ready orders and free people where greedy visibly loses", async () => {
    await start(true);

    const response = await admin.post("/dispatch/demo-scenario", {});

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ orders: 8, deliveryPersons: 8 });
    const optimization = (
      await admin.post("/orders/optimize-assignment", {})
    ).json<OptimizeAssignmentResponse>();
    // Quatro armadilhas de 6 km contra 4 km: o guloso paga pelo menos 8 km a mais.
    expect(
      optimization.baseline.totalDistanceKm - optimization.totalDistanceKm,
    ).toBeGreaterThanOrEqual(7.5);
  });

  it("replaces the previous scenario instead of piling up", async () => {
    await start(true);

    await admin.post("/dispatch/demo-scenario", {});
    await admin.post("/dispatch/demo-scenario", {});

    expect(await demoOrdersReady()).toHaveLength(8);
    const people = (await admin.get("/delivery-persons")).json<{ data: { name: string }[] }>();
    expect(people.data.filter((person) => person.name.startsWith("[Demo]"))).toHaveLength(8);
  });

  it("forbids the viewer", async () => {
    await start(true);
    const viewer = apiClient(app, await tokenFor(db, "viewer"));

    expect((await viewer.post("/dispatch/demo-scenario", {})).statusCode).toBe(403);
  });
});
