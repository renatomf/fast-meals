import type { DeliveryPerson, Order, Product } from "@fastmeals/contracts";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { App } from "../src/app.ts";
import { seedOfficialData } from "../src/db/seed-official.ts";
import { orders, orderStatusHistory } from "../src/models/index.ts";
import { apiClient, tokenFor, type ApiClient } from "./support/api.ts";
import { buildTestApp } from "./support/app.ts";
import { connectTestDatabase, truncateAll } from "./support/database.ts";

const { pool, db } = connectTestDatabase();
let app: App;
let admin: ApiClient;
let viewer: ApiClient;
let adminToken: string;
let viewerToken: string;
const productIds = new Map<string, string>();
const deliveryPersonIds = new Map<string, string>();

const customer = {
  customerName: "Maria Oliveira",
  customerPhone: "(21) 98765-4321",
  deliveryAddress: "Av. Brasil, 456, Rio de Janeiro - RJ",
  latitude: -22.9068,
  longitude: -43.1729,
};

beforeAll(async () => {
  await truncateAll(db);
  await seedOfficialData(db);
  adminToken = await tokenFor(db, "admin");
  viewerToken = await tokenFor(db, "viewer");
  const setup = await buildTestApp({ db });
  const client = apiClient(setup, adminToken);
  for (const product of (await client.get("/products?limit=100")).json<{ data: Product[] }>()
    .data) {
    productIds.set(product.name, product.id);
  }
  for (const person of (await client.get("/delivery-persons")).json<{ data: DeliveryPerson[] }>()
    .data) {
    deliveryPersonIds.set(person.name, person.id);
  }
  await setup.close();
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

function productId(name: string): string {
  const id = productIds.get(name);
  if (!id) throw new Error(`Unknown seed product ${name}`);
  return id;
}

function deliveryPersonId(name: string): string {
  const id = deliveryPersonIds.get(name);
  if (!id) throw new Error(`Unknown seed delivery person ${name}`);
  return id;
}

async function createOrder(items = [{ productId: productId("X-Burger Especial"), quantity: 1 }]) {
  const response = await admin.post("/orders", { ...customer, items });
  if (response.statusCode !== 201) throw new Error(`Order not created: ${response.body}`);
  return response.json<Order>();
}

async function readyOrder(): Promise<Order> {
  const order = await createOrder();
  await admin.patch(`/orders/${order.id}/status`, { status: "preparing" });
  return (await admin.patch(`/orders/${order.id}/status`, { status: "ready" })).json<Order>();
}

async function warmUpPool() {
  // Sem conexões abertas, a primeira requisição termina antes de as outras conectarem e
  // não há disputa nenhuma (DECISIONS.md, "Dificuldades").
  await Promise.all(Array.from({ length: 10 }, () => pool.query("select pg_sleep(0.05)")));
}

describe("GET /api/orders", () => {
  it("lists the seeded orders with items, product names and the delivery person", async () => {
    const response = await admin.get("/orders?limit=100");

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: Order[]; pagination: unknown }>();
    expect(body.pagination).toEqual({ page: 1, limit: 100, total: 12, totalPages: 1 });
    const delivering = body.data.find((order) => order.customerName === "Fernando Costa");
    expect(delivering).toMatchObject({
      status: "delivering",
      deliveryPerson: { name: "Carlos Santos", vehicleType: "motorcycle" },
      items: expect.arrayContaining([
        expect.objectContaining({ product: expect.objectContaining({ name: expect.any(String) }) }),
      ]),
    });
    expect(body.data.find((order) => order.status === "pending")?.deliveryPerson).toBeNull();
  });

  it("filters by status", async () => {
    const response = await admin.get("/orders?status=ready");

    const statuses = response.json<{ data: Order[] }>().data.map((order) => order.status);
    expect(statuses).toEqual(["ready", "ready", "ready"]);
  });

  it("sorts by total amount", async () => {
    const response = await admin.get("/orders?sortBy=totalAmount&sortOrder=asc&limit=100");

    const totals = response.json<{ data: Order[] }>().data.map((order) => order.totalAmount);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  // 02:30 UTC de 15/01 ainda é 14/01 em São Paulo: o filtro precisa usar o dia local.
  it("filters by day in the São Paulo time zone", async () => {
    const order = await createOrder();
    await db
      .update(orders)
      .set({ createdAt: new Date("2025-01-15T02:30:00Z") })
      .where(eq(orders.id, order.id));

    const onTheLocalDay = await admin.get("/orders?startDate=2025-01-14&endDate=2025-01-14");
    const onTheUtcDay = await admin.get("/orders?startDate=2025-01-15&endDate=2025-01-15");

    expect(onTheLocalDay.json<{ data: Order[] }>().data.map((item) => item.id)).toEqual([order.id]);
    expect(onTheUtcDay.json().pagination.total).toBe(0);
  });

  it("refuses an end date before the start date", async () => {
    const response = await admin.get("/orders?startDate=2025-02-01&endDate=2025-01-01");

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual([
      { field: "endDate", message: "A data final deve ser igual ou posterior à inicial" },
    ]);
  });

  it("lets the viewer read", async () => {
    expect((await viewer.get("/orders")).statusCode).toBe(200);
  });
});

describe("POST /api/orders", () => {
  it("criação válida: computes the total on the server from the current prices", async () => {
    const order = await createOrder([
      { productId: productId("X-Burger Especial"), quantity: 2 },
      { productId: productId("Suco de Laranja Natural"), quantity: 1 },
    ]);

    expect(order).toMatchObject({
      ...customer,
      status: "pending",
      totalAmount: 78.3,
      deliveryPerson: null,
    });
    expect(order.items.map((item) => [item.product.name, item.quantity, item.unitPrice])).toEqual([
      ["X-Burger Especial", 2, 32.9],
      ["Suco de Laranja Natural", 1, 12.5],
    ]);
  });

  it("keeps the price of the moment the order was placed", async () => {
    const created = await admin.post("/products", {
      name: "Prato do dia",
      description: "Prato que muda de preço durante o teste",
      price: 30,
      category: "meal",
      preparationTime: 20,
    });
    const product = created.json<Product>();
    const order = await createOrder([{ productId: product.id, quantity: 3 }]);

    await admin.put(`/products/${product.id}`, { price: 45 });

    const reloaded = (await admin.get(`/orders/${order.id}`)).json<Order>();
    expect(reloaded.items[0]?.unitPrice).toBe(30);
    expect(reloaded.totalAmount).toBe(90);
  });

  it("refuses unavailable and unknown products with details, creating nothing", async () => {
    const unknownId = "00000000-0000-4000-8000-000000000000";
    const before = (await admin.get("/orders")).json().pagination.total;

    const response = await admin.post("/orders", {
      ...customer,
      items: [
        { productId: productId("X-Burger Especial"), quantity: 1 },
        { productId: productId("Wrap de Carne Seca"), quantity: 1 },
        { productId: unknownId, quantity: 1 },
      ],
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: "UNAVAILABLE_PRODUCT",
        message: "Um ou mais produtos não estão disponíveis",
        details: [
          {
            productId: productId("Wrap de Carne Seca"),
            productName: "Wrap de Carne Seca",
            reason: "Produto indisponível",
          },
          { productId: unknownId, productName: null, reason: "Produto não encontrado" },
        ],
      },
    });
    expect((await admin.get("/orders")).json().pagination.total).toBe(before);
  });

  it("validates the phone format, the items and the coordinates", async () => {
    const response = await admin.post("/orders", {
      ...customer,
      customerPhone: "21987654321",
      latitude: 91,
      items: [
        { productId: productId("X-Burger Especial"), quantity: 1 },
        { productId: productId("X-Burger Especial"), quantity: 2 },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual(
      expect.arrayContaining([
        { field: "customerPhone", message: "O telefone deve estar no formato (XX) XXXXX-XXXX" },
        { field: "latitude", message: "A latitude deve estar entre -90 e 90" },
        {
          field: "items",
          message: "Cada produto deve aparecer uma vez; use a quantidade para repetir",
        },
      ]),
    );
  });

  it("records the creation in the history, with its author", async () => {
    const order = await createOrder();

    const history = (await admin.get(`/orders/${order.id}/history`)).json();

    expect(history.data).toEqual([
      expect.objectContaining({
        fromStatus: null,
        toStatus: "pending",
        changedBy: expect.objectContaining({ email: "admin@fastmeals.com" }),
      }),
    ]);
  });

  it("forbids the viewer", async () => {
    const response = await viewer.post("/orders", {
      ...customer,
      items: [{ productId: productId("X-Burger Especial"), quantity: 1 }],
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("PATCH /api/orders/:id/status", () => {
  it("transição válida: moves pending to preparing and records it", async () => {
    const order = await createOrder();

    const response = await admin.patch(`/orders/${order.id}/status`, { status: "preparing" });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("preparing");
    const history = (await admin.get(`/orders/${order.id}/history`)).json();
    expect(history.data.at(-1)).toMatchObject({ fromStatus: "pending", toStatus: "preparing" });
  });

  it("transição inválida: refuses delivered → pending with 422", async () => {
    const delivered = (await admin.get("/orders?status=delivered")).json<{ data: Order[] }>()
      .data[0];

    const response = await admin.patch(`/orders/${delivered?.id}/status`, { status: "pending" });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: "Não é possível alterar o status de 'delivered' para 'pending'",
      },
    });
  });

  it("refuses ready → delivering without a delivery person", async () => {
    const order = await readyOrder();

    const response = await admin.patch(`/orders/${order.id}/status`, { status: "delivering" });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.message).toBe(
      "Não é possível alterar o status de 'ready' para 'delivering' sem um entregador atribuído",
    );
  });

  it("walks the whole lifecycle and keeps one history entry per step", async () => {
    const order = await readyOrder();
    await admin.patch(`/orders/${order.id}/assign`, {
      deliveryPersonId: deliveryPersonId("Juliana Costa"),
    });

    await admin.patch(`/orders/${order.id}/status`, { status: "delivering" });
    const delivered = await admin.patch(`/orders/${order.id}/status`, { status: "delivered" });

    expect(delivered.json()).toMatchObject({
      status: "delivered",
      deliveryPerson: { name: "Juliana Costa" },
    });
    const steps = (await admin.get(`/orders/${order.id}/history`))
      .json()
      .data.map((entry: { toStatus: string }) => entry.toStatus);
    expect(steps).toEqual(["pending", "preparing", "ready", "delivering", "delivered"]);
  });

  it("lets only one of 20 simultaneous identical transitions through", async () => {
    const order = await createOrder();
    await warmUpPool();

    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        admin.patch(`/orders/${order.id}/status`, { status: "preparing" }),
      ),
    );

    expect(responses.filter((response) => response.statusCode === 200)).toHaveLength(1);
    const recorded = await db
      .select({ id: orderStatusHistory.id })
      .from(orderStatusHistory)
      .where(
        sql`${orderStatusHistory.orderId} = ${order.id} and ${orderStatusHistory.toStatus} = 'preparing'`,
      );
    expect(recorded).toHaveLength(1);
  });

  it("returns 404 for an unknown order", async () => {
    const response = await admin.patch("/orders/00000000-0000-4000-8000-000000000000/status", {
      status: "preparing",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("ORDER_NOT_FOUND");
  });

  it("forbids the viewer", async () => {
    const order = await createOrder();

    expect(
      (await viewer.patch(`/orders/${order.id}/status`, { status: "preparing" })).statusCode,
    ).toBe(403);
  });
});

describe("PATCH /api/orders/:id/assign", () => {
  it("assigns an active, free delivery person to a ready order", async () => {
    const order = await readyOrder();

    const response = await admin.patch(`/orders/${order.id}/assign`, {
      deliveryPersonId: deliveryPersonId("Mariana Souza"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().deliveryPerson).toMatchObject({ name: "Mariana Souza" });
    const person = await admin.get(`/delivery-persons/${deliveryPersonId("Mariana Souza")}`);
    expect(person.json().currentOrderId).toBe(order.id);
    await admin.patch(`/orders/${order.id}/status`, { status: "cancelled" });
  });

  it("refuses a delivery person who is already on another order", async () => {
    const order = await readyOrder();

    const response = await admin.patch(`/orders/${order.id}/assign`, {
      deliveryPersonId: deliveryPersonId("Carlos Santos"),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: "DELIVERY_PERSON_UNAVAILABLE",
        message: "Este entregador já está atribuído a outro pedido em andamento",
      },
    });
  });

  it("refuses an inactive delivery person", async () => {
    const order = await readyOrder();

    const response = await admin.patch(`/orders/${order.id}/assign`, {
      deliveryPersonId: deliveryPersonId("Pedro Oliveira"),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.message).toBe("Este entregador está inativo");
  });

  it("refuses an order that is not ready", async () => {
    const order = await createOrder();

    const response = await admin.patch(`/orders/${order.id}/assign`, {
      deliveryPersonId: deliveryPersonId("Ana Ferreira"),
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: "ORDER_NOT_ASSIGNABLE",
        message: "Só pedidos com status 'ready' podem receber entregador; este está 'pending'",
      },
    });
  });

  it("returns 404 for an unknown delivery person", async () => {
    const order = await readyOrder();

    const response = await admin.patch(`/orders/${order.id}/assign`, {
      deliveryPersonId: "00000000-0000-4000-8000-000000000000",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("DELIVERY_PERSON_NOT_FOUND");
  });

  it("frees the delivery person when a ready order is cancelled", async () => {
    const order = await readyOrder();
    const roberto = deliveryPersonId("Roberto Lima");
    await admin.patch(`/orders/${order.id}/assign`, { deliveryPersonId: roberto });

    await admin.patch(`/orders/${order.id}/status`, { status: "cancelled" });

    const available = (await admin.get("/delivery-persons?available=true")).json<{
      data: DeliveryPerson[];
    }>();
    expect(available.data.map((person) => person.id)).toContain(roberto);
  });

  it("gives one delivery person to exactly one of 20 orders assigned at the same time", async () => {
    const readyOrders = await Promise.all(Array.from({ length: 20 }, () => readyOrder()));
    const ana = deliveryPersonId("Ana Ferreira");
    await warmUpPool();

    const responses = await Promise.all(
      readyOrders.map((order) =>
        admin.patch(`/orders/${order.id}/assign`, { deliveryPersonId: ana }),
      ),
    );

    const succeeded = responses.filter((response) => response.statusCode === 200);
    expect(succeeded).toHaveLength(1);
    expect(
      responses
        .filter((response) => response.statusCode !== 200)
        .map((response) => response.json().error.code),
    ).toEqual(Array(19).fill("DELIVERY_PERSON_UNAVAILABLE"));
    const [{ assigned } = { assigned: -1 }] = await db
      .select({ assigned: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        sql`${orders.deliveryPersonId} = ${ana} and ${orders.status} in ('ready', 'delivering')`,
      );
    expect(assigned).toBe(1);
  });

  it("forbids the viewer", async () => {
    const order = await readyOrder();

    const response = await viewer.patch(`/orders/${order.id}/assign`, {
      deliveryPersonId: deliveryPersonId("Ana Ferreira"),
    });

    expect(response.statusCode).toBe(403);
  });
});

// Exclusão e uso disputando a mesma linha: os dois lados podem vencer, mas o resultado
// nunca pode ser um pedido aberto apontando para algo excluído.
describe("deleting while in use", () => {
  it("never leaves an open order with a product deleted at the same time", async () => {
    const product = (
      await admin.post("/products", {
        name: "Produto disputado",
        description: "Excluído enquanto entra em pedidos",
        price: 20,
        category: "side",
        preparationTime: 10,
      })
    ).json<{ id: string }>();
    await warmUpPool();

    const [deletion, ...creations] = await Promise.all([
      admin.delete(`/products/${product.id}`),
      ...Array.from({ length: 10 }, () =>
        admin.post("/orders", { ...customer, items: [{ productId: product.id, quantity: 1 }] }),
      ),
    ]);

    const created = creations.filter((response) => response.statusCode === 201);
    if (deletion?.statusCode === 204) {
      expect(created).toHaveLength(0);
    } else {
      expect(deletion?.statusCode).toBe(409);
      expect(created.length).toBeGreaterThan(0);
    }
  });

  it("never leaves an active order with a delivery person deleted at the same time", async () => {
    const person = (
      await admin.post("/delivery-persons", {
        name: "Entregador disputado",
        phone: "(11) 94444-0000",
        vehicleType: "car",
      })
    ).json<{ id: string }>();
    const readyOrders = await Promise.all(Array.from({ length: 5 }, () => readyOrder()));
    await warmUpPool();

    const [deletion, ...assignments] = await Promise.all([
      admin.delete(`/delivery-persons/${person.id}`),
      ...readyOrders.map((order) =>
        admin.patch(`/orders/${order.id}/assign`, { deliveryPersonId: person.id }),
      ),
    ]);

    const assigned = assignments.filter((response) => response.statusCode === 200);
    if (deletion?.statusCode === 204) {
      expect(assigned).toHaveLength(0);
    } else {
      expect(deletion?.statusCode).toBe(409);
      expect(assigned).toHaveLength(1);
    }
  });
});
