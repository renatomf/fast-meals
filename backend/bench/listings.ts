import { eq, sql } from "drizzle-orm";
import { createSigner } from "fast-jwt";
import { buildApp } from "../src/app.ts";
import { loadEnv } from "../src/config/env.ts";
import { createDatabase } from "../src/db/client.ts";
import { createPool, pingDatabase } from "../src/db/pool.ts";
import { orders, users } from "../src/models/index.ts";

// npm run bench:listings — tempo das listagens e dos relatórios com o banco cheio
// (rode antes npm run seed:load). Usa app.inject: mede roteamento, validação, consulta e
// serialização, sem a rede.

const RUNS = 50;
const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
const db = createDatabase(pool);
const app = await buildApp({
  env: { ...env, NODE_ENV: "test", RATE_LIMIT_MAX: 1_000_000 },
  db,
  checkDatabase: () => pingDatabase(pool),
});

const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
if (!admin) throw new Error("No admin user; run npm run seed first");
const token = createSigner({ key: env.JWT_SECRET, expiresIn: 60_000 * 15 })({
  sub: admin.id,
  role: "admin",
});
const [volume] = await db.select({ total: sql<number>`count(*)::int` }).from(orders);

const today = new Date().toISOString().slice(0, 10);
const ninetyDaysAgo = new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10);

const routes = [
  "/api/orders?limit=20",
  "/api/orders?limit=100",
  "/api/orders?status=delivered&limit=20",
  `/api/orders?startDate=${ninetyDaysAgo}&endDate=${today}&sortBy=totalAmount&limit=20`,
  "/api/orders?page=450&limit=20",
  "/api/products?search=burg",
  "/api/delivery-persons?available=true",
  `/api/reports/revenue?startDate=${ninetyDaysAgo}&endDate=${today}`,
  "/api/reports/orders-by-status",
  "/api/reports/top-products",
  "/api/reports/average-delivery-time",
];

function percentile(samples: number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ?? 0;
}

console.log(
  `${volume?.total ?? 0} pedidos no banco, ${RUNS} requisições por rota, Node ${process.version}`,
);
console.log("| Rota | Mediana | p95 | Máximo |");
console.log("| --- | --- | --- | --- |");
for (const url of routes) {
  const call = () => app.inject({ url, headers: { authorization: `Bearer ${token}` } });
  for (let warmUp = 0; warmUp < 5; warmUp++) await call();
  const samples: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const startedAt = performance.now();
    const response = await call();
    samples.push(performance.now() - startedAt);
    if (response.statusCode !== 200) throw new Error(`${url} answered ${response.statusCode}`);
  }
  console.log(
    `| \`${url.replace(ninetyDaysAgo, "<90 dias atrás>").replace(today, "<hoje>")}\` | ${percentile(samples, 0.5).toFixed(1)} ms | ${percentile(samples, 0.95).toFixed(1)} ms | ${Math.max(...samples).toFixed(1)} ms |`,
  );
}

await app.close();
await pool.end();
