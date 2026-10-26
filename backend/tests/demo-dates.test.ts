import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { shiftDemoHistory } from "../src/db/demo-dates.ts";
import { seedOfficialData } from "../src/db/seed-official.ts";
import { orders } from "../src/models/index.ts";
import { connectTestDatabase, truncateAll } from "./support/database.ts";

const { pool, db } = connectTestDatabase();
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await pool.end();
});

type Snapshot = { id: string; status: string; createdAt: number; updatedAt: number };

async function snapshot(): Promise<Snapshot[]> {
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .orderBy(orders.id);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }));
}

async function newestActivity(): Promise<number> {
  const { rows } = await db.execute<{ newest: string }>(sql`
    select greatest(
      (select max(greatest(created_at, updated_at)) from orders),
      (select max(changed_at) from order_status_history)
    )::text as newest`);
  return new Date(rows[0]?.newest ?? 0).getTime();
}

describe("demo history refresh", () => {
  it("does nothing on an empty database", async () => {
    expect(await shiftDemoHistory(db)).toEqual({ closed: 0, active: 0 });
  });

  it("moves only the group that fell behind", async () => {
    // No seed oficial, os pedidos em andamento são de minutos atrás e os encerrados, de
    // dias atrás: só os encerrados andam.
    await seedOfficialData(db);
    const active = (await snapshot()).filter(
      (order) => !["delivered", "cancelled"].includes(order.status),
    );

    const shift = await shiftDemoHistory(db);

    expect(shift.active).toBe(0);
    expect(shift.closed).toBeGreaterThan(0);
    expect((await snapshot()).filter((order) => active.some((a) => a.id === order.id))).toEqual(
      active,
    );
  });

  it("moves each group by whole days, keeping every order in the past", async () => {
    await seedOfficialData(db);
    const before = await snapshot();
    // Quatro dias e meio depois do seed: a demo ficou parada esse tempo.
    const now = new Date(Date.now() + 4.5 * DAY_MS);

    const shift = await shiftDemoHistory(db, now);

    expect(shift.closed).toBeGreaterThanOrEqual(4);
    expect(shift.active).toBe(4);
    const after = await snapshot();
    for (const [index, order] of after.entries()) {
      const original = before[index];
      const days = ["delivered", "cancelled"].includes(order.status) ? shift.closed : shift.active;
      expect(order.createdAt - (original?.createdAt ?? 0)).toBe(days * DAY_MS);
      // O updated_at anda junto, em vez de ser carimbado com o horário da atualização.
      expect(order.updatedAt - (original?.updatedAt ?? 0)).toBe(days * DAY_MS);
    }
    const newest = await newestActivity();
    expect(newest).toBeLessThanOrEqual(now.getTime());
    expect(newest).toBeGreaterThan(now.getTime() - DAY_MS);
  });

  it("follows the bulk of the history, not an order someone just closed", async () => {
    // Cinco dias de volume, de 2 a 6 dias atrás, e um pedido cancelado agora há pouco.
    await seedOfficialData(db);
    await db.execute(sql`
      insert into orders (customer_name, customer_phone, delivery_address, latitude, longitude,
        status, total_amount, created_at, updated_at)
      select 'Volume ' || g, '(11) 90000-0000', 'Rua do Volume, 100, São Paulo - SP',
        -23.56, -46.65, 'delivered', 50,
        now() - (2 + g % 5) * interval '1 day', now() - (2 + g % 5) * interval '1 day'
      from generate_series(1, 50) g`);
    const [justClosed] = await db
      .insert(orders)
      .values({
        customerName: "Cancelado agora",
        customerPhone: "(11) 90000-0001",
        deliveryAddress: "Rua do Teste, 200, São Paulo - SP",
        latitude: -23.56,
        longitude: -46.65,
        status: "cancelled",
        totalAmount: "10.00",
      })
      .returning({ id: orders.id, createdAt: orders.createdAt });

    const shift = await shiftDemoHistory(db);

    // O volume terminava 2 dias atrás: anda 1 ou 2 dias, conforme a hora do dia.
    expect(shift.closed).toBeGreaterThanOrEqual(1);
    const [closed] = await db
      .select({ createdAt: orders.createdAt })
      .from(orders)
      .where(eq(orders.id, justClosed?.id ?? ""));
    expect(closed?.createdAt.getTime()).toBe(justClosed?.createdAt.getTime());
    expect(await newestActivity()).toBeLessThanOrEqual(Date.now());
  });

  it("is idempotent for the same moment", async () => {
    await seedOfficialData(db);
    const now = new Date(Date.now() + 3.2 * DAY_MS);
    await shiftDemoHistory(db, now);
    const after = await snapshot();

    expect(await shiftDemoHistory(db, now)).toEqual({ closed: 0, active: 0 });
    expect(await snapshot()).toEqual(after);
  });

  it("turns the triggers back on afterwards", async () => {
    await seedOfficialData(db);
    await shiftDemoHistory(db, new Date(Date.now() + 2.5 * DAY_MS));
    const [order] = await snapshot();

    await db
      .update(orders)
      .set({ customerName: "Gatilho de volta" })
      .where(eq(orders.id, order?.id ?? ""));

    const [updated] = await snapshot();
    // O set_updated_at voltou a carimbar o horário real da alteração.
    expect(updated?.updatedAt).toBeGreaterThan(Date.now() - 60_000);
    expect(updated?.updatedAt).toBeLessThanOrEqual(Date.now() + 1_000);
  });
});
