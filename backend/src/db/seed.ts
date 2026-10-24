import { loadEnv } from "../config/env.ts";
import { createDatabase } from "./client.ts";
import { migrateDatabase } from "./migrate.ts";
import { createPool } from "./pool.ts";
import { seedOfficialData } from "./seed-official.ts";

// npm run seed            aplica as migrations e popula um banco vazio
// npm run seed -- --reset apaga tudo e popula de novo
const env = loadEnv();
const pool = createPool(env.DATABASE_URL);

try {
  await migrateDatabase(pool);
  const summary = await seedOfficialData(createDatabase(pool), {
    reset: process.argv.includes("--reset"),
  });
  console.log(
    summary.seeded
      ? `Seeded ${summary.users} users, ${summary.products} products, ` +
          `${summary.deliveryPersons} delivery persons and ${summary.orders} orders.`
      : "Database already has data; nothing to do. Run with --reset to start over.",
  );
} finally {
  await pool.end();
}
