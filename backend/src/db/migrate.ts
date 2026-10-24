import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type pg from "pg";
import { createDatabase } from "./client.ts";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

// Número arbitrário, fixo: identifica o lock de "setup do banco" entre processos.
export const SETUP_LOCK_ID = 7_301_001;

// Duas instâncias subindo juntas (ou seed e testes em paralelo) não podem aplicar a
// mesma migration ao mesmo tempo. O lock de sessão serializa quem chegar depois.
export async function migrateDatabase(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [SETUP_LOCK_ID]);
    await migrate(createDatabase(client), { migrationsFolder });
  } finally {
    await client.query("select pg_advisory_unlock($1)", [SETUP_LOCK_ID]);
    client.release();
  }
}
