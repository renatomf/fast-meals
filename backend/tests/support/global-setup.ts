import pg from "pg";
import { migrateDatabase } from "../../src/db/migrate.ts";
import { TEST_DATABASE_URL } from "./database.ts";

// Cria o banco de teste se ainda não existir e aplica as migrations uma vez por execução.
export default async function setup(): Promise<void> {
  const target = new URL(TEST_DATABASE_URL);
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  const maintenanceUrl = new URL(TEST_DATABASE_URL);
  maintenanceUrl.pathname = "/postgres";

  const admin = new pg.Client({ connectionString: maintenanceUrl.toString() });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      `Integration tests need PostgreSQL at ${target.host}.\n` +
        "Start it with `docker compose up -d db` or point TEST_DATABASE_URL to another server.",
      { cause: error },
    );
  }
  try {
    const { rowCount } = await admin.query("select 1 from pg_database where datname = $1", [
      databaseName,
    ]);
    if (rowCount === 0) {
      await admin.query(`create database ${pg.escapeIdentifier(databaseName)}`);
    }
  } finally {
    await admin.end();
  }

  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await migrateDatabase(pool);
  } finally {
    await pool.end();
  }
}
