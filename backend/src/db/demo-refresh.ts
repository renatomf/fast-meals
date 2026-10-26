import { createDatabase } from "./client.ts";
import { shiftDemoHistory } from "./demo-dates.ts";
import { createPool } from "./pool.ts";

// npm run demo:refresh — traz o histórico de pedidos da demo para perto de hoje. Roda todo
// dia pelo workflow "Demo refresh" no GitHub Actions. Só precisa do DATABASE_URL: lê a
// variável direto, sem o loadEnv, que exigiria os segredos JWT da API.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = createPool(databaseUrl);
try {
  const shift = await shiftDemoHistory(createDatabase(pool));
  console.log(
    shift.closed || shift.active
      ? `Moved the demo history forward: closed orders ${shift.closed} day(s), active orders ${shift.active} day(s).`
      : "Demo history is current; nothing to do.",
  );
} finally {
  await pool.end();
}
