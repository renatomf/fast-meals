import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authorize, createAuthenticate } from "../src/middlewares/auth.ts";
import { errorHandler } from "../src/middlewares/error-handler.ts";
import type { RequestUser } from "../src/modules/auth/auth.service.ts";
import { AppError } from "../src/utils/app-error.ts";

// A verificação do token em si é coberta em auth.test.ts; aqui o foco é a regra
// 401 × 403, montada do mesmo jeito que as rotas protegidas do app.
const users: Record<string, RequestUser> = {
  "admin-token": { id: "a", role: "admin" },
  "viewer-token": { id: "v", role: "viewer" },
};

let app: FastifyInstance;

beforeEach(async () => {
  app = Fastify();
  app.setErrorHandler(errorHandler);
  app.decorateRequest("user", null);
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook(
      "onRequest",
      createAuthenticate((token) => {
        const user = users[token];
        if (!user) throw new AppError(401, "INVALID_TOKEN", "Token de acesso inválido");
        return user;
      }),
    );
    protectedRoutes.get("/products", async () => ({ ok: true }));
    protectedRoutes.post("/products", { preHandler: authorize("admin") }, async () => ({
      ok: true,
    }));
  });
  app.post("/unguarded", { preHandler: authorize("admin") }, async () => ({ ok: true }));
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function request(method: "GET" | "POST", url: string, token?: string) {
  return app.inject({
    method,
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("authorization", () => {
  it("lets the viewer read", async () => {
    expect((await request("GET", "/products", "viewer-token")).statusCode).toBe(200);
  });

  it("answers 403 FORBIDDEN when the viewer tries to write", async () => {
    const response = await request("POST", "/products", "viewer-token");

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: { code: "FORBIDDEN", message: "Você não tem permissão para esta ação" },
    });
  });

  it("lets the admin write", async () => {
    expect((await request("POST", "/products", "admin-token")).statusCode).toBe(200);
  });

  it("answers 401, not 403, when there is no token", async () => {
    const response = await request("POST", "/products");

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("INVALID_TOKEN");
  });

  it("ignores schemes other than Bearer", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/products",
      // Token válido com o esquema errado: só o esquema pode causar a recusa.
      headers: { authorization: "Basic admin-token" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("fails closed when authorize runs without authenticate", async () => {
    expect((await request("POST", "/unguarded", "admin-token")).statusCode).toBe(401);
  });
});
