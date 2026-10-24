import type pg from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { apiDatabaseLimits, createPool } from "../src/db/pool.ts";
import { buildTestApp } from "./support/app.ts";
import { connectTestDatabase, TEST_DATABASE_URL } from "./support/database.ts";

const pools: pg.Pool[] = [];

function pool(limits?: typeof apiDatabaseLimits) {
  const created = createPool(TEST_DATABASE_URL, limits);
  pools.push(created);
  return created;
}

async function setting(target: pg.Pool, name: string) {
  const { rows } = await target.query<Record<string, string>>(`show ${name}`);
  return rows[0]?.[name];
}

afterEach(async () => {
  await Promise.all(pools.splice(0).map((created) => created.end()));
});

describe("database limits", () => {
  // Conferido no próprio PostgreSQL: prova que o valor chegou à sessão, não só ao objeto.
  it("makes PostgreSQL cancel API queries after 10 s and idle transactions after 15 s", async () => {
    const api = pool(apiDatabaseLimits);

    expect(await setting(api, "statement_timeout")).toBe("10s");
    expect(await setting(api, "idle_in_transaction_session_timeout")).toBe("15s");
  });

  it("leaves migrations and seeds without a statement limit", async () => {
    const seeding = pool();

    expect(await setting(seeding, "statement_timeout")).toBe("0");
  });

  it("fails a request waiting for a connection instead of hanging when the pool is exhausted", async () => {
    const api = pool(apiDatabaseLimits);
    const held = await Promise.all(Array.from({ length: 10 }, () => api.connect()));
    const startedAt = Date.now();

    await expect(api.connect()).rejects.toThrow(/timeout/i);

    expect(Date.now() - startedAt).toBeLessThan(7_000);
    for (const client of held) client.release();
  }, 10_000);
});

describe("HTTP limits", () => {
  const { pool: testPool, db } = connectTestDatabase();

  afterAll(async () => {
    await testPool.end();
  });

  it("closes requests after 30 s and idle connections after 10 s", async () => {
    const app = await buildTestApp({ db });

    expect(app.initialConfig).toMatchObject({ requestTimeout: 30_000, connectionTimeout: 10_000 });
    await app.close();
  });
});
