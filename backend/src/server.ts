import { buildApp } from "./app.ts";
import { loadEnv, type Env } from "./config/env.ts";
import { createDatabase } from "./db/client.ts";
import { apiDatabaseLimits, createPool, pingDatabase } from "./db/pool.ts";
import { createPostgresChangeFeed } from "./modules/realtime/change-feed.ts";

const SHUTDOWN_TIMEOUT_MS = 10_000;

let env: Env;
try {
  env = loadEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const pool = createPool(env.DATABASE_URL, apiDatabaseLimits);
const changeFeed = createPostgresChangeFeed(env.DATABASE_URL);
const app = await buildApp({
  env,
  db: createDatabase(pool),
  checkDatabase: () => pingDatabase(pool),
  changeFeed,
});
await changeFeed.start(app.log);

async function shutdown(signal: NodeJS.Signals) {
  app.log.info({ signal }, "shutting down");
  // Se alguma conexão travar o close, não deixa o container pendurado até o SIGKILL.
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();

  await app.close();
  await changeFeed.stop();
  await pool.end();
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.fatal({ err: error }, "failed to start");
  await pool.end();
  process.exit(1);
}
