import { buildApp, type App } from "../../src/app.ts";
import { loadEnv, type Env } from "../../src/config/env.ts";
import type { Database } from "../../src/db/client.ts";
import { TEST_DATABASE_URL } from "./database.ts";

export const testEnv = loadEnv({
  NODE_ENV: "test",
  DATABASE_URL: TEST_DATABASE_URL,
  JWT_SECRET: "test-access-secret-at-least-32-characters",
  JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-characters",
});

type TestAppOptions = {
  db: Database;
  env?: Partial<Env>;
  databaseUp?: boolean;
};

export function buildTestApp({ db, env, databaseUp = true }: TestAppOptions): Promise<App> {
  return buildApp({
    env: { ...testEnv, ...env },
    db,
    checkDatabase: async () => databaseUp,
  });
}
