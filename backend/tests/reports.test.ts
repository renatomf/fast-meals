import type { OrderStatus } from "@fastmeals/contracts";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { App } from "../src/app.ts";
import { seedOfficialData } from "../src/db/seed-official.ts";
import {
  deliveryPersons,
  orderItems,
  orders,
  orderStatusHistory,
  products,
} from "../src/models/index.ts";
import { centsToDecimal, toCents } from "../src/utils/money.ts";
import { apiClient, tokenFor, type ApiClient } from "./support/api.ts";
import { buildTestApp } from "./support/app.ts";
import { connectTestDatabase } from "./support/database.ts";

const { pool, db } = connectTestDatabase();
let app: App;
let admin: ApiClient;
let viewerToken: string;

const MINUTE = 60_000;

type FixtureOrder = {
  createdAtSaoPaulo: string;
  status: OrderStatus;
  items: [productName: string, quantity: number][];
  delivery?: { by: string; minutes: number };
};

// Um conjunto pequeno e fixo, em janeiro de 2025 (longe das datas do seed), com os
// resultados esperados calculados à mão nos testes. Horários em São Paulo (UTC-3).
const fixture: FixtureOrder[] = [
  // 10/01: dois entregues, um de moto (30 min) e um de bicicleta (50 min).
  {
    createdAtSaoPaulo: "2025-01-10T12:00",
    status: "delivered",
    items: [["X-Burger Especial", 2]],
    delivery: { by: "Carlos Santos", minutes: 30 },
  },
  {
    createdAtSaoPaulo: "2025-01-10T19:00",
    status: "delivered",
    items: [
      ["Suco de Laranja Natural", 1],
      ["Pudim de Leite Condensado", 1],
    ],
    delivery: { by: "Ana Ferreira", minutes: 50 },
  },
  // 11/01: só um pendente, que não entra na receita.
  {
    createdAtSaoPaulo: "2025-01-11T12:00",
    status: "pending",
    items: [["Suco de Laranja Natural", 1]],
  },
  // 12/01: um cancelado (fora da receita) e um entregue às 23h30, que em UTC já é dia 13.
  { createdAtSaoPaulo: "2025-01-12T13:00", status: "cancelled", items: [["X-Burger Especial", 3]] },
  {
    createdAtSaoPaulo: "2025-01-12T23:30",
    status: "delivered",
    items: [["X-Burger Especial", 1]],
    delivery: { by: "Roberto Lima", minutes: 20 },
  },
  // Fora do período 10–13: 23h59 do dia 9 (já dia 10 em UTC) e dia 14.
  {
    createdAtSaoPaulo: "2025-01-09T23:59",
    status: "delivered",
    items: [["Pudim de Leite Condensado", 1]],
    delivery: { by: "Carlos Santos", minutes: 15 },
  },
  {
    createdAtSaoPaulo: "2025-01-14T12:00",
    status: "delivered",
    items: [["Suco de Laranja Natural", 4]],
    delivery: { by: "Juliana Costa", minutes: 40 },
  },
];

const PERIOD = "startDate=2025-01-10&endDate=2025-01-13";

const statusPath: Record<OrderStatus, OrderStatus[]> = {
  pending: ["pending"],
  preparing: ["pending", "preparing"],
  ready: ["pending", "preparing", "ready"],
  delivering: ["pending", "preparing", "ready", "delivering"],
  delivered: ["pending", "preparing", "ready", "delivering", "delivered"],
  cancelled: ["pending", "cancelled"],
};

async function insertFixture() {
  const productRows = await db.select().from(products);
  const personRows = await db.select().from(deliveryPersons);
  for (const entry of fixture) {
    const createdAt = new Date(`${entry.createdAtSaoPaulo}:00-03:00`);
    const lines = entry.items.map(([name, quantity]) => {
      const product = productRows.find((row) => row.name === name);
      if (!product) throw new Error(`Unknown product ${name}`);
      return { productId: product.id, quantity, unitPrice: product.price };
    });
    const totalCents = lines.reduce(
      (sum, line) => sum + toCents(line.unitPrice) * line.quantity,
      0,
    );
    const person = entry.delivery && personRows.find((row) => row.name === entry.delivery?.by);
    const [order] = await db
      .insert(orders)
      .values({
        customerName: "Cliente do relatório",
        customerPhone: "(11) 91111-1111",
        deliveryAddress: "Rua do Relatório, 100, São Paulo",
        latitude: -23.55,
        longitude: -46.63,
        status: entry.status,
        totalAmount: centsToDecimal(totalCents),
        deliveryPersonId: person?.id ?? null,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: orders.id });
    if (!order) throw new Error("order not inserted");
    await db.insert(orderItems).values(lines.map((line) => ({ ...line, orderId: order.id })));
    const path = statusPath[entry.status];
    await db.insert(orderStatusHistory).values(
      path.map((toStatus, index) => ({
        orderId: order.id,
        fromStatus: path[index - 1] ?? null,
        toStatus,
        // Só o instante da entrega importa para os relatórios; os passos do meio ficam em +1 min.
        changedAt:
          toStatus === "delivered"
            ? new Date(createdAt.getTime() + (entry.delivery?.minutes ?? 0) * MINUTE)
            : new Date(createdAt.getTime() + index * MINUTE),
      })),
    );
  }
}

beforeAll(async () => {
  await seedOfficialData(db, { reset: true });
  await insertFixture();
  viewerToken = await tokenFor(db, "viewer");
});

beforeEach(async () => {
  app = await buildTestApp({ db });
  admin = apiClient(app, await tokenFor(db, "admin"));
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await pool.end();
});

describe("GET /api/reports/revenue: receita por período", () => {
  it("sums delivered orders by São Paulo day, with zero on days without sales", async () => {
    const response = await admin.get(`/reports/revenue?${PERIOD}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      startDate: "2025-01-10",
      endDate: "2025-01-13",
      // 65,80 (2 X-Burger) + 26,50 (suco e pudim) + 32,90 (X-Burger das 23h30 do dia 12)
      totalRevenue: 125.2,
      totalOrders: 3,
      averageOrderValue: 41.73,
      dailyRevenue: [
        { date: "2025-01-10", revenue: 92.3, orders: 2 },
        { date: "2025-01-11", revenue: 0, orders: 0 },
        { date: "2025-01-12", revenue: 32.9, orders: 1 },
        { date: "2025-01-13", revenue: 0, orders: 0 },
      ],
    });
  });

  it("returns zeros for a period without sales", async () => {
    const response = await admin.get("/reports/revenue?startDate=2024-06-01&endDate=2024-06-02");

    expect(response.json()).toMatchObject({
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
    });
    expect(response.json().dailyRevenue).toHaveLength(2);
  });

  it("requires both dates and limits the period to 366 days", async () => {
    const missing = await admin.get("/reports/revenue?startDate=2025-01-10");
    const tooLong = await admin.get("/reports/revenue?startDate=2024-01-01&endDate=2025-01-02");

    expect(missing.statusCode).toBe(400);
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json().error.details).toEqual([
      { field: "endDate", message: "O período pode ter no máximo 366 dias" },
    ]);
  });
});

describe("GET /api/reports/orders-by-status", () => {
  it("counts every status in the period, including the ones with no orders", async () => {
    const response = await admin.get(`/reports/orders-by-status?${PERIOD}`);

    expect(response.json()).toEqual({
      data: [
        { status: "pending", count: 1 },
        { status: "preparing", count: 0 },
        { status: "ready", count: 0 },
        { status: "delivering", count: 0 },
        { status: "delivered", count: 3 },
        { status: "cancelled", count: 1 },
      ],
      total: 5,
    });
  });

  it("counts every order when no period is given", async () => {
    const response = await admin.get("/reports/orders-by-status");

    // 12 do seed mais os 7 do conjunto de teste.
    expect(response.json().total).toBe(19);
  });
});

describe("GET /api/reports/top-products: produtos mais vendidos", () => {
  it("ranks delivered quantities, breaking ties by revenue", async () => {
    const response = await admin.get(`/reports/top-products?${PERIOD}`);

    expect(
      response.json().data.map(({ productId: _, ...rest }: { productId: string }) => rest),
    ).toEqual([
      // 2 + 1 X-Burger entregues; os 3 do pedido cancelado não contam.
      { productName: "X-Burger Especial", totalQuantity: 3, totalRevenue: 98.7 },
      // Pudim e suco empatam em quantidade; o pudim fatura mais.
      { productName: "Pudim de Leite Condensado", totalQuantity: 1, totalRevenue: 14 },
      { productName: "Suco de Laranja Natural", totalQuantity: 1, totalRevenue: 12.5 },
    ]);
  });

  it("respects the limit", async () => {
    const response = await admin.get(`/reports/top-products?${PERIOD}&limit=1`);

    expect(response.json().data).toHaveLength(1);
  });
});

describe("GET /api/reports/average-delivery-time", () => {
  it("averages the time from creation to delivered, overall and by vehicle", async () => {
    const response = await admin.get(`/reports/average-delivery-time?${PERIOD}`);

    expect(response.json()).toEqual({
      // (30 + 50 + 20) / 3
      averageMinutes: 33.3,
      fastestMinutes: 20,
      slowestMinutes: 50,
      totalDelivered: 3,
      byVehicleType: [
        { vehicleType: "bicycle", averageMinutes: 50, count: 1 },
        { vehicleType: "motorcycle", averageMinutes: 25, count: 2 },
        { vehicleType: "car", averageMinutes: 0, count: 0 },
      ],
    });
  });
});

describe("reports: access", () => {
  it("are open to the viewer", async () => {
    const viewer = apiClient(app, viewerToken);

    expect((await viewer.get(`/reports/revenue?${PERIOD}`)).statusCode).toBe(200);
    expect((await viewer.get("/reports/top-products")).statusCode).toBe(200);
  });

  it("require authentication", async () => {
    expect((await apiClient(app).get("/reports/orders-by-status")).statusCode).toBe(401);
  });
});
