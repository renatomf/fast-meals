import { buildApp, type App } from "../../src/app.ts";
import { loadEnv, type Env } from "../../src/config/env.ts";
import type { Database } from "../../src/db/client.ts";
import type { ChangeFeed } from "../../src/modules/realtime/change-feed.ts";
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
  logs?: CapturedLogs;
  changeFeed?: ChangeFeed;
};

export function buildTestApp({
  db,
  env,
  databaseUp = true,
  logs,
  changeFeed,
}: TestAppOptions): Promise<App> {
  return buildApp({
    env: { ...testEnv, ...env },
    db,
    checkDatabase: async () => databaseUp,
    logStream: logs,
    changeFeed,
  });
}

export type LogEntry = { level: number; msg: string } & Record<string, unknown>;

export type CapturedLogs = {
  write: (line: string) => void;
  entries: LogEntry[];
  find: (message: string) => LogEntry[];
};

// Recebe as linhas JSON do Pino para os testes verificarem os eventos de segurança.
export function captureLogs(): CapturedLogs {
  const entries: LogEntry[] = [];
  return {
    write: (line) => {
      entries.push(JSON.parse(line) as LogEntry);
    },
    entries,
    find: (message) => entries.filter((entry) => entry.msg === message),
  };
}
