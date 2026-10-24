import type { DeliveryPerson, Order } from "@fastmeals/contracts";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { App } from "../src/app.ts";
import { seedOfficialData } from "../src/db/seed-official.ts";
import { apiClient, tokenFor, type ApiClient } from "./support/api.ts";
import { buildTestApp } from "./support/app.ts";
import { connectTestDatabase, truncateAll } from "./support/database.ts";

const { pool, db } = connectTestDatabase();
let app: App;
let admin: ApiClient;
let viewer: ApiClient;
let adminToken: string;
let viewerToken: string;

const newDeliveryPerson = {
  name: "Bruno Rocha",
  phone: "(11) 95555-0000",
  vehicleType: "bicycle",
};

beforeAll(async () => {
  await truncateAll(db);
  await seedOfficialData(db);
  adminToken = await tokenFor(db, "admin");
  viewerToken = await tokenFor(db, "viewer");
});

beforeEach(async () => {
  app = await buildTestApp({ db });
  admin = apiClient(app, adminToken);
  viewer = apiClient(app, viewerToken);
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await pool.end();
});

async function listNames(query = "") {
  const response = await admin.get(`/delivery-persons${query}`);
  return response.json<{ data: DeliveryPerson[] }>().data.map((person) => person.name);
}

async function named(name: string): Promise<DeliveryPerson> {
  const response = await admin.get("/delivery-persons");
  const person = response
    .json<{ data: DeliveryPerson[] }>()
    .data.find((item) => item.name === name);
  if (!person) throw new Error(`Delivery person ${name} not found`);
  return person;
}

describe("GET /api/delivery-persons", () => {
  it("lists everyone by name, with the order currently held", async () => {
    const response = await admin.get("/delivery-persons");

    expect(response.statusCode).toBe(200);
    const people = response.json<{ data: DeliveryPerson[] }>().data;
    expect(people.map((person) => person.name)).toEqual([
      "Ana Ferreira",
      "Carlos Santos",
      "Juliana Costa",
      "Mariana Souza",
      "Pedro Oliveira",
      "Roberto Lima",
    ]);
    const deliveringOrder = (await admin.get("/orders?status=delivering")).json<{
      data: Order[];
    }>().data[0];
    expect(people.find((person) => person.name === "Carlos Santos")?.currentOrderId).toBe(
      deliveringOrder?.id,
    );
    expect(people.find((person) => person.name === "Ana Ferreira")?.currentOrderId).toBeNull();
  });

  it('filters by isActive, reading "false" as false', async () => {
    expect(await listNames("?isActive=false")).toEqual(["Pedro Oliveira"]);
  });

  it("available=true leaves out whoever holds a ready or delivering order", async () => {
    expect(await listNames("?available=true")).not.toContain("Carlos Santos");
    expect(await listNames("?available=false")).toEqual(["Carlos Santos"]);
  });

  it("lets the viewer read", async () => {
    expect((await viewer.get("/delivery-persons")).statusCode).toBe(200);
  });
});

describe("POST /api/delivery-persons", () => {
  it("creates an active delivery person without location by default", async () => {
    const response = await admin.post("/delivery-persons", newDeliveryPerson);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      ...newDeliveryPerson,
      isActive: true,
      currentLatitude: null,
      currentLongitude: null,
      currentOrderId: null,
    });
  });

  it("validates name, phone, vehicle and half coordinates", async () => {
    const response = await admin.post("/delivery-persons", {
      name: "Al",
      phone: "11955550000",
      vehicleType: "scooter",
      currentLatitude: -23.5,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual(
      expect.arrayContaining([
        { field: "name", message: "O nome deve ter entre 3 e 100 caracteres" },
        { field: "phone", message: "O telefone deve estar no formato (XX) XXXXX-XXXX" },
        { field: "vehicleType", message: "O veículo deve ser bicycle, motorcycle, car" },
      ]),
    );
  });

  it("refuses latitude without longitude", async () => {
    const response = await admin.post("/delivery-persons", {
      ...newDeliveryPerson,
      currentLatitude: -23.5,
    });

    expect(response.json().error.details).toEqual([
      { field: "currentLongitude", message: "Envie latitude e longitude juntas, ou as duas nulas" },
    ]);
  });

  it("forbids the viewer", async () => {
    expect((await viewer.post("/delivery-persons", newDeliveryPerson)).statusCode).toBe(403);
  });
});

describe("PUT /api/delivery-persons/:id", () => {
  it("changes only the fields sent", async () => {
    const juliana = await named("Juliana Costa");

    const response = await admin.put(`/delivery-persons/${juliana.id}`, {
      currentLatitude: -23.6,
      currentLongitude: -46.7,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: "Juliana Costa",
      vehicleType: juliana.vehicleType,
      currentLatitude: -23.6,
      currentLongitude: -46.7,
    });
  });

  it("requires the two coordinates together", async () => {
    const juliana = await named("Juliana Costa");

    const response = await admin.put(`/delivery-persons/${juliana.id}`, { currentLatitude: -23 });

    expect(response.statusCode).toBe(400);
  });

  it("returns 404 for an unknown delivery person", async () => {
    const response = await admin.put("/delivery-persons/00000000-0000-4000-8000-000000000000", {
      isActive: false,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("DELIVERY_PERSON_NOT_FOUND");
  });
});

describe("DELETE /api/delivery-persons/:id", () => {
  it("removes a delivery person who holds no order", async () => {
    const created = (await admin.post("/delivery-persons", newDeliveryPerson)).json();

    expect((await admin.delete(`/delivery-persons/${created.id}`)).statusCode).toBe(204);
    expect((await admin.get(`/delivery-persons/${created.id}`)).statusCode).toBe(404);
  });

  it("refuses to remove a delivery person on an order in progress", async () => {
    const carlos = await named("Carlos Santos");

    const response = await admin.delete(`/delivery-persons/${carlos.id}`);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: "DELIVERY_PERSON_IN_USE",
        message:
          "Não é possível remover este entregador: ele está atribuído a um pedido em andamento",
      },
    });
  });

  it("keeps a removed delivery person in the orders they already delivered", async () => {
    const ana = await named("Ana Ferreira");

    expect((await admin.delete(`/delivery-persons/${ana.id}`)).statusCode).toBe(204);

    expect(await listNames()).not.toContain("Ana Ferreira");
    const delivered = (await admin.get("/orders?status=delivered&limit=100")).json<{
      data: Order[];
    }>().data;
    expect(delivered.map((order) => order.deliveryPerson?.name)).toContain("Ana Ferreira");
  });

  it("forbids the viewer", async () => {
    const roberto = await named("Roberto Lima");

    expect((await viewer.delete(`/delivery-persons/${roberto.id}`)).statusCode).toBe(403);
  });
});
