import type { ChangeEvent, OrdersByStatusReport, RevenueReport } from "@fastmeals/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { App } from "../src/app.ts";
import { seedOfficialData } from "../src/db/seed-official.ts";
import { createChangeHub } from "../src/modules/realtime/change-feed.ts";
import { createReportsCache } from "../src/modules/reports/reports-cache.ts";
import type { ReportsService } from "../src/modules/reports/reports.service.ts";
import { apiClient, tokenFor } from "./support/api.ts";
import { buildTestApp } from "./support/app.ts";
import { connectTestDatabase, truncateAll } from "./support/database.ts";

const orderChanged: ChangeEvent = {
  entity: "orders",
  op: "update",
  id: "0190a0b0-0000-7000-8000-0000000000aa",
  status: "delivered",
};

const period = { startDate: "2026-10-01", endDate: "2026-10-25" };

// Service falso que conta as consultas e deixa o teste decidir quando cada uma termina.
function fakeService() {
  let total = 1;
  const pending: (() => void)[] = [];
  const revenue = vi.fn(
    (query: { startDate: string; endDate: string }) =>
      new Promise<RevenueReport>((resolve) => {
        const value = total;
        pending.push(() =>
          resolve({
            ...query,
            totalRevenue: value,
            totalOrders: 0,
            averageOrderValue: 0,
            dailyRevenue: [],
          }),
        );
      }),
  );
  const service = {
    revenue,
    ordersByStatus: vi.fn(async (): Promise<OrdersByStatusReport> => ({ data: [], total })),
    topProducts: vi.fn(async () => ({ data: [] })),
    averageDeliveryTime: vi.fn(),
  } as unknown as ReportsService;
  return {
    service,
    revenue,
    setTotal: (value: number) => {
      total = value;
    },
    finishAll: () => pending.splice(0).forEach((finish) => finish()),
  };
}

function setup(options: { ttlMs?: number; maxEntries?: number; now?: () => number } = {}) {
  const hub = createChangeHub();
  const fake = fakeService();
  const cache = createReportsCache(fake.service, { changeFeed: hub, ...options });
  return { hub, cache, ...fake };
}

describe("reports cache", () => {
  it("answers a repeated report from memory", async () => {
    const { cache, revenue, finishAll } = setup();

    const first = cache.revenue(period);
    finishAll();
    await first;
    await cache.revenue(period);

    expect(revenue).toHaveBeenCalledTimes(1);
  });

  it("keys the cache by the report parameters, in any order", async () => {
    const { cache, revenue, finishAll } = setup();

    const calls = [
      cache.revenue(period),
      cache.revenue({ endDate: period.endDate, startDate: period.startDate }),
      cache.revenue({ ...period, endDate: "2026-10-24" }),
    ];
    finishAll();
    await Promise.all(calls);

    expect(revenue).toHaveBeenCalledTimes(2);
  });

  it("runs simultaneous identical requests as one query", async () => {
    const { cache, revenue, finishAll } = setup();

    const requests = Array.from({ length: 20 }, () => cache.revenue(period));
    finishAll();
    const results = await Promise.all(requests);

    expect(revenue).toHaveBeenCalledTimes(1);
    expect(new Set(results).size).toBe(1);
  });

  it("forgets everything when the database reports a change", async () => {
    const { hub, cache, revenue, setTotal, finishAll } = setup();
    const first = cache.revenue(period);
    finishAll();
    expect((await first).totalRevenue).toBe(1);

    setTotal(2);
    hub.publish(orderChanged);
    const second = cache.revenue(period);
    finishAll();

    expect((await second).totalRevenue).toBe(2);
    expect(revenue).toHaveBeenCalledTimes(2);
  });

  it("does not keep a result that started before a change and finished after it", async () => {
    const { hub, cache, revenue, finishAll } = setup();

    const stale = cache.revenue(period);
    hub.publish(orderChanged);
    finishAll();
    await stale;
    const fresh = cache.revenue(period);
    finishAll();
    await fresh;

    expect(revenue).toHaveBeenCalledTimes(2);
  });

  it("does not keep errors", async () => {
    const { cache, service } = setup();
    vi.mocked(service.ordersByStatus)
      .mockRejectedValueOnce(new Error("statement timeout"))
      .mockResolvedValueOnce({ data: [], total: 3 });

    await expect(cache.ordersByStatus({})).rejects.toThrow("statement timeout");

    expect((await cache.ordersByStatus({})).total).toBe(3);
  });

  it("expires entries after the TTL, in case a change notification was lost", async () => {
    let clock = 0;
    const { cache, revenue, finishAll } = setup({ ttlMs: 30_000, now: () => clock });
    const first = cache.revenue(period);
    finishAll();
    await first;

    clock = 29_999;
    await cache.revenue(period);
    expect(revenue).toHaveBeenCalledTimes(1);

    clock = 30_000;
    const expired = cache.revenue(period);
    finishAll();
    await expired;
    expect(revenue).toHaveBeenCalledTimes(2);
  });

  it("drops the oldest entries above the size limit", async () => {
    const { cache, finishAll } = setup({ maxEntries: 3 });

    const calls = ["01", "02", "03", "04", "05"].map((day) =>
      cache.revenue({ startDate: `2026-10-${day}`, endDate: "2026-10-25" }),
    );
    finishAll();
    await Promise.all(calls);

    expect(cache.size).toBe(3);
  });
});

// Pela API: com o feed ligado, o relatório vem do cache até o banco avisar de uma mudança.
describe("GET /api/reports with the change feed", () => {
  const { pool, db } = connectTestDatabase();
  const hub = createChangeHub();
  let app: App;

  beforeAll(async () => {
    await truncateAll(db);
    await seedOfficialData(db);
    app = await buildTestApp({ db, changeFeed: hub });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("serves the cached report until a change arrives", async () => {
    const viewer = apiClient(app, await tokenFor(db, "viewer"));
    const admin = apiClient(app, await tokenFor(db, "admin"));
    const before = (await viewer.get("/reports/orders-by-status")).json<OrdersByStatusReport>();

    const product = (await admin.get("/products?limit=1")).json<{ data: { id: string }[] }>()
      .data[0];
    await admin.post("/orders", {
      customerName: "Cliente Cache",
      customerPhone: "(11) 98765-4321",
      deliveryAddress: "Rua Augusta, 1500 - Consolação",
      latitude: -23.5558,
      longitude: -46.6622,
      items: [{ productId: product?.id, quantity: 1 }],
    });

    // Sem aviso do banco (o feed aqui é manual), o cache ainda responde o número antigo.
    expect((await viewer.get("/reports/orders-by-status")).json<OrdersByStatusReport>().total).toBe(
      before.total,
    );

    hub.publish(orderChanged);

    expect((await viewer.get("/reports/orders-by-status")).json<OrdersByStatusReport>().total).toBe(
      before.total + 1,
    );
  });
});
