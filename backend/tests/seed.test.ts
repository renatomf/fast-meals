import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedOfficialData } from "../src/db/seed-official.ts";
import { users } from "../src/models/index.ts";
import { connectTestDatabase, truncateAll } from "./support/database.ts";

const { pool, db } = connectTestDatabase();

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await pool.end();
});

async function orderTotalsByStatus() {
  const { rows } = await db.execute(sql`
    select status, count(*)::int as orders, sum(total_amount)::text as revenue
    from orders group by status order by status`);
  return rows;
}

describe("official seed", () => {
  it("loads every record from seed/data.json into an empty database", async () => {
    const summary = await seedOfficialData(db);

    expect(summary).toEqual({
      seeded: true,
      users: 2,
      products: 15,
      deliveryPersons: 6,
      orders: 12,
    });
  });

  it("leaves a database that already has data untouched", async () => {
    await seedOfficialData(db);
    const before = await orderTotalsByStatus();

    const summary = await seedOfficialData(db);

    expect(summary).toEqual({ seeded: false });
    expect(await orderTotalsByStatus()).toEqual(before);
  });

  it("produces the same orders and totals on every reset", async () => {
    await seedOfficialData(db, { reset: true });
    const first = await orderTotalsByStatus();

    await seedOfficialData(db, { reset: true });

    expect(await orderTotalsByStatus()).toEqual(first);
  });

  it("stores passwords as bcrypt hashes with cost 12", async () => {
    await seedOfficialData(db);

    const stored = await db.select({ password: users.password }).from(users);

    for (const { password } of stored) {
      expect(password).toMatch(/^\$2b\$12\$/);
    }
  });

  it("gives every order a status history that starts at creation and ends at its current status", async () => {
    await seedOfficialData(db);

    const { rows } = await db.execute<{ status: string; path: string[] }>(sql`
      select o.status, array_agg(coalesce(h.from_status, '∅') || '→' || h.to_status
                                 order by h.changed_at) as path
      from orders o join order_status_history h on h.order_id = o.id
      group by o.id`);

    for (const { status, path } of rows) {
      expect(path[0]).toBe("∅→pending");
      expect(path.at(-1)).toMatch(new RegExp(`→${status}$`));
    }
  });

  it("keeps every order and its history in the past", async () => {
    const now = new Date();
    await seedOfficialData(db, { now });

    const { rows } = await db.execute<{ latest: Date }>(sql`
      select greatest(max(o.updated_at), max(h.changed_at)) as latest
      from orders o join order_status_history h on h.order_id = o.id`);

    expect(new Date(rows[0]?.latest ?? 0).getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
