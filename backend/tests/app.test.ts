import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { App } from "../src/app.ts";
import { loadEnv } from "../src/config/env.ts";
import { buildTestApp, testEnv } from "./support/app.ts";
import { connectTestDatabase } from "./support/database.ts";

const { pool, db } = connectTestDatabase();
let app: App;

async function startApp({ databaseUp = true } = {}) {
  app = await buildTestApp({ db, databaseUp });
  return app;
}

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await pool.end();
});

describe("GET /api/health", () => {
  it("reports ok when the database answers", async () => {
    await startApp();

    const response = await app.inject("/api/health");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", database: "up" });
  });

  it("returns 503 when the database is down", async () => {
    await startApp({ databaseUp: false });

    const response = await app.inject("/api/health");

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: "degraded", database: "down" });
  });
});

describe("cross-cutting HTTP behavior", () => {
  it("answers unknown routes with the standard error format", async () => {
    await startApp();

    const response = await app.inject("/api/nope");

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Rota GET /api/nope não encontrada" },
    });
  });

  it("rejects malformed JSON with the standard error format", async () => {
    await startApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/health",
      headers: { "content-type": "application/json" },
      payload: "{bad",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("sends security headers", async () => {
    await startApp();

    const response = await app.inject("/api/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("never reflects an arbitrary origin in CORS headers", async () => {
    await startApp();

    const response = await app.inject({
      url: "/api/health",
      headers: { origin: "https://evil.example" },
    });

    // Com origem fixa, o header sempre traz a origem configurada; o navegador
    // bloqueia qualquer outra por não bater.
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});

describe("loadEnv", () => {
  it("explains which variables are wrong", () => {
    expect(() => loadEnv({ DATABASE_URL: "mysql://nope" })).toThrow(/DATABASE_URL/);
  });

  it("converts token lifetimes to milliseconds", () => {
    expect(testEnv.JWT_EXPIRES_IN).toBe(15 * 60 * 1000);
    expect(testEnv.JWT_REFRESH_EXPIRES_IN).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("refuses the same secret for access and refresh tokens", () => {
    const secret = "x".repeat(32);
    expect(() =>
      loadEnv({
        DATABASE_URL: testEnv.DATABASE_URL,
        JWT_SECRET: secret,
        JWT_REFRESH_SECRET: secret,
      }),
    ).toThrow(/JWT_REFRESH_SECRET: deve ser diferente/);
  });
});
