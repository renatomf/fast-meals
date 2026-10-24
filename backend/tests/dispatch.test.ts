import {
  NO_AVAILABLE_DELIVERY_PERSON,
  type DeliveryPerson,
  type OptimizeAssignmentResponse,
  type Order,
} from "@fastmeals/contracts";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { haversineKm } from "../src/algorithms/haversine.ts";
import type { App } from "../src/app.ts";
import { seedOfficialData } from "../src/db/seed-official.ts";
import { apiClient, tokenFor, type ApiClient } from "./support/api.ts";
import { buildTestApp } from "./support/app.ts";
import { connectTestDatabase } from "./support/database.ts";

const { pool, db } = connectTestDatabase();
let app: App;
let admin: ApiClient;
let viewer: ApiClient;

// Cada teste mexe em quem está ativo e em quais pedidos estão prontos: parte sempre do seed.
beforeEach(async () => {
  await seedOfficialData(db, { reset: true });
  app = await buildTestApp({ db });
  admin = apiClient(app, await tokenFor(db, "admin"));
  viewer = apiClient(app, await tokenFor(db, "viewer"));
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await pool.end();
});

function optimize(query = "") {
  return admin.post(`/orders/optimize-assignment${query}`, {});
}

async function readyOrders() {
  const response = await admin.get("/orders?status=ready&limit=100");
  return response.json<{ data: Order[] }>().data.filter((order) => order.deliveryPerson === null);
}

async function availablePeople() {
  const response = await admin.get("/delivery-persons?isActive=true&available=true");
  return response
    .json<{ data: DeliveryPerson[] }>()
    .data.filter((person) => person.currentLatitude !== null);
}

// Oráculo independente: todas as atribuições possíveis, com a mesma fórmula de distância.
function bruteForceKm(orders: Order[], people: DeliveryPerson[]): number {
  let best = Number.POSITIVE_INFINITY;
  const used = new Set<number>();
  const slots = Math.min(orders.length, people.length);
  function visit(index: number, assigned: number, sum: number) {
    if (assigned === slots) {
      best = Math.min(best, sum);
      return;
    }
    if (index === orders.length) return;
    const order = orders[index];
    if (!order) return;
    // Com mais pedidos que pessoas, um pedido pode ficar de fora.
    if (orders.length - index > slots - assigned) visit(index + 1, assigned, sum);
    people.forEach((person, column) => {
      if (used.has(column)) return;
      used.add(column);
      const distance = haversineKm(order, {
        latitude: person.currentLatitude ?? 0,
        longitude: person.currentLongitude ?? 0,
      });
      visit(index + 1, assigned + 1, sum + distance);
      used.delete(column);
    });
  }
  visit(0, 0, 0);
  return slots === 0 ? 0 : best;
}

async function deactivateEveryone() {
  for (const person of (await admin.get("/delivery-persons")).json<{ data: DeliveryPerson[] }>()
    .data) {
    await admin.put(`/delivery-persons/${person.id}`, { isActive: false });
  }
}

describe("POST /api/orders/optimize-assignment: caso com solução", () => {
  it("assigns every ready order to a different person with the minimum total distance", async () => {
    const orders = await readyOrders();
    const people = await availablePeople();

    const response = await optimize();

    expect(response.statusCode).toBe(200);
    const body = response.json<OptimizeAssignmentResponse>();
    expect(body.algorithm).toBe("hungarian");
    expect(body.assignments).toHaveLength(Math.min(orders.length, people.length));
    expect(body.unassigned).toEqual([]);
    expect(new Set(body.assignments.map((item) => item.deliveryPersonId)).size).toBe(
      body.assignments.length,
    );
    expect(body.totalDistanceKm).toBeCloseTo(bruteForceKm(orders, people), 2);
    expect(body.baseline.algorithm).toBe("greedy");
    expect(body.baseline.totalDistanceKm).toBeGreaterThanOrEqual(body.totalDistanceKm);
  });

  it("describes each assignment with the address, the person and the distance", async () => {
    const orders = await readyOrders();
    const people = await availablePeople();

    const body = (await optimize()).json<OptimizeAssignmentResponse>();

    for (const assignment of body.assignments) {
      const order = orders.find((item) => item.id === assignment.orderId);
      const person = people.find((item) => item.id === assignment.deliveryPersonId);
      expect(assignment.orderAddress).toBe(order?.deliveryAddress);
      expect(assignment.deliveryPersonName).toBe(person?.name);
      expect(assignment.estimatedDistanceKm).toBeCloseTo(
        haversineKm(
          { latitude: order?.latitude ?? 0, longitude: order?.longitude ?? 0 },
          { latitude: person?.currentLatitude ?? 0, longitude: person?.currentLongitude ?? 0 },
        ),
        2,
      );
    }
  });

  it("reports the execution time in the body, the log and the Server-Timing header", async () => {
    const response = await optimize();

    expect(response.json().executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(response.headers["server-timing"]).toMatch(/^hungarian;dur=[\d.]+, greedy;dur=[\d.]+$/);
  });

  it("returns the distance matrix only when asked", async () => {
    const without = (await optimize()).json();
    const withMatrix = (await optimize("?includeMatrix=true")).json<OptimizeAssignmentResponse>();

    expect(without.costMatrix).toBeUndefined();
    const matrix = withMatrix.costMatrix;
    expect(matrix?.distancesKm).toHaveLength(matrix?.orderIds.length ?? -1);
    expect(matrix?.distancesKm[0]).toHaveLength(matrix?.deliveryPersonIds.length ?? -1);
  });

  it("leaves the extra orders unassigned when there are more orders than people", async () => {
    const people = await availablePeople();
    for (const person of people.slice(1)) {
      await admin.put(`/delivery-persons/${person.id}`, { isActive: false });
    }
    const orders = await readyOrders();

    const body = (await optimize()).json<OptimizeAssignmentResponse>();

    expect(body.assignments).toHaveLength(1);
    expect(body.unassigned).toHaveLength(orders.length - 1);
    expect(body.unassigned.every((item) => item.reason === NO_AVAILABLE_DELIVERY_PERSON)).toBe(
      true,
    );
  });

  it("ignores people without a location and orders that already have someone", async () => {
    const [first, second] = await availablePeople();
    const [assignedOrder] = await readyOrders();
    await admin.put(`/delivery-persons/${first?.id}`, {
      currentLatitude: null,
      currentLongitude: null,
    });
    await admin.patch(`/orders/${assignedOrder?.id}/assign`, { deliveryPersonId: second?.id });

    const body = (await optimize()).json<OptimizeAssignmentResponse>();

    const involvedPeople = body.assignments.map((item) => item.deliveryPersonId);
    const involvedOrders = [...body.assignments, ...body.unassigned].map((item) => item.orderId);
    expect(involvedPeople).not.toContain(first?.id);
    expect(involvedPeople).not.toContain(second?.id);
    expect(involvedOrders).not.toContain(assignedOrder?.id);
  });

  it("only suggests: nothing is assigned until someone accepts", async () => {
    await optimize();

    expect((await readyOrders()).every((order) => order.deliveryPerson === null)).toBe(true);
  });
});

describe("POST /api/orders/optimize-assignment: sem entregadores disponíveis", () => {
  it("returns every ready order as unassigned", async () => {
    const orders = await readyOrders();
    await deactivateEveryone();

    const body = (await optimize()).json<OptimizeAssignmentResponse>();

    expect(body.assignments).toEqual([]);
    expect(body.totalDistanceKm).toBe(0);
    expect(body.unassigned.map((item) => item.orderId).sort()).toEqual(
      orders.map((order) => order.id).sort(),
    );
    expect(body.unassigned[0]).toMatchObject({
      reason: NO_AVAILABLE_DELIVERY_PERSON,
      orderAddress: expect.any(String),
    });
  });

  it("returns empty lists when no order is ready, as in the api-spec", async () => {
    for (const order of await readyOrders()) {
      await admin.patch(`/orders/${order.id}/status`, { status: "cancelled" });
    }

    const body = (await optimize()).json<OptimizeAssignmentResponse>();

    expect(body).toMatchObject({
      assignments: [],
      unassigned: [],
      totalDistanceKm: 0,
      algorithm: "hungarian",
      baseline: { algorithm: "greedy", totalDistanceKm: 0 },
    });
  });
});

describe("POST /api/orders/optimize-assignment: access", () => {
  it("forbids the viewer", async () => {
    expect((await viewer.post("/orders/optimize-assignment", {})).statusCode).toBe(403);
  });

  it("requires authentication", async () => {
    expect((await apiClient(app).post("/orders/optimize-assignment", {})).statusCode).toBe(401);
  });
});
