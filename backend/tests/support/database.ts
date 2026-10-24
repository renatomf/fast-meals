import { sql } from "drizzle-orm";
import pg from "pg";
import { createDatabase, type Database } from "../../src/db/client.ts";

// O Postgres do docker-compose (porta 5433), num banco separado do de desenvolvimento.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://fastmeals:fastmeals123@localhost:5433/fastmeals_test";

export function connectTestDatabase(): { pool: pg.Pool; db: Database } {
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 10 });
  return { pool, db: createDatabase(pool) };
}

export async function truncateAll(db: Database): Promise<void> {
  await db.execute(
    sql`truncate users, products, delivery_persons, orders, order_items, order_status_history, refresh_tokens`,
  );
}
