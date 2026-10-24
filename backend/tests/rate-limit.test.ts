import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { App } from "../src/app.ts";
import type { Env } from "../src/config/env.ts";
import { buildTestApp, captureLogs } from "./support/app.ts";
import { connectTestDatabase } from "./support/database.ts";

const { pool, db } = connectTestDatabase();
let app: App;

async function startApp(env?: Partial<Env>) {
  app = await buildTestApp({ db, env });
  return app;
}

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await pool.end();
});

describe("rate limiting", () => {
  it("answers the 101st request in a minute with 429 RATE_LIMIT_EXCEEDED", async () => {
    await startApp();

    for (let i = 0; i < 100; i++) {
      expect((await app.inject("/api/health")).statusCode).toBe(200);
    }
    const response = await app.inject("/api/health");

    expect(response.statusCode).toBe(429);
    expect(response.json().error).toMatchObject({
      code: "RATE_LIMIT_EXCEEDED",
      message: expect.stringMatching(/^Limite de requisições atingido/),
    });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("allows only 10 login attempts per minute", async () => {
    await startApp();
    const attempt = () =>
      app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "admin@fastmeals.com", password: "guess" },
      });

    for (let i = 0; i < 10; i++) {
      expect((await attempt()).statusCode).toBe(401);
    }

    expect((await attempt()).statusCode).toBe(429);
  });

  it("limits login attempts per email even when they come from many IPs", async () => {
    const logs = captureLogs();
    app = await buildTestApp({ db, env: { TRUST_PROXY_HOPS: 1 }, logs });
    const attempt = (ip: string, email: string) =>
      app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { "x-forwarded-for": ip },
        payload: { email, password: "guess" },
      });

    // Cada tentativa de um IP diferente, alternando maiúsculas: o limite por IP não age
    // e a variação de caixa não abre uma conta "nova".
    for (let i = 0; i < 10; i++) {
      const email = i % 2 === 0 ? "admin@fastmeals.com" : "Admin@FastMeals.com";
      expect((await attempt(`203.0.113.${i}`, email)).statusCode).toBe(401);
    }
    const blocked = await attempt("198.51.100.7", "admin@fastmeals.com");

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error).toMatchObject({
      code: "RATE_LIMIT_EXCEEDED",
      message: expect.stringMatching(/^Muitas tentativas de login para este email/),
    });
    expect((await attempt("198.51.100.7", "viewer@fastmeals.com")).statusCode).toBe(401);
    expect(logs.find("login blocked for this email after repeated failures")).toHaveLength(1);
  });

  it("also counts requests to routes that do not exist", async () => {
    await startApp({ RATE_LIMIT_MAX: 2 });

    await app.inject("/api/nope");
    await app.inject("/api/nope");

    expect((await app.inject("/api/nope")).statusCode).toBe(429);
  });

  it("limits each client separately behind a trusted proxy", async () => {
    await startApp({ RATE_LIMIT_MAX: 1, TRUST_PROXY_HOPS: 1 });
    const from = (ip: string) =>
      app.inject({ url: "/api/health", headers: { "x-forwarded-for": ip } });

    expect((await from("203.0.113.1")).statusCode).toBe(200);
    expect((await from("203.0.113.1")).statusCode).toBe(429);
    expect((await from("203.0.113.2")).statusCode).toBe(200);
  });

  it("ignores X-Forwarded-For when no proxy is trusted, so the header cannot dodge the limit", async () => {
    await startApp({ RATE_LIMIT_MAX: 1 });
    const from = (ip: string) =>
      app.inject({ url: "/api/health", headers: { "x-forwarded-for": ip } });

    expect((await from("203.0.113.1")).statusCode).toBe(200);
    expect((await from("203.0.113.2")).statusCode).toBe(429);
  });
});
