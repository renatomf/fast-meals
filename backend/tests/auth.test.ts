import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { createSigner } from "fast-jwt";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { App } from "../src/app.ts";
import { seedOfficialData } from "../src/db/seed-official.ts";
import { refreshTokens } from "../src/models/index.ts";
import { buildTestApp, testEnv } from "./support/app.ts";
import { connectTestDatabase, truncateAll } from "./support/database.ts";

const ADMIN = { email: "admin@fastmeals.com", password: "Admin@123" };
const VIEWER = { email: "viewer@fastmeals.com", password: "Viewer@123" };

const { pool, db } = connectTestDatabase();
let app: App;

beforeAll(async () => {
  await truncateAll(db);
  await seedOfficialData(db);
});

beforeEach(async () => {
  await db.delete(refreshTokens);
  app = await buildTestApp({ db });
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await pool.end();
});

function login(credentials: { email: string; password: string } = ADMIN) {
  return app.inject({ method: "POST", url: "/api/auth/login", payload: credentials });
}

async function loginTokens(credentials = ADMIN) {
  const body = (await login(credentials)).json<{
    accessToken: string;
    refreshToken: string;
    user: { id: string };
  }>();
  return body;
}

function refresh(refreshToken: string) {
  return app.inject({ method: "POST", url: "/api/auth/refresh", payload: { refreshToken } });
}

function me(accessToken: string) {
  return app.inject({
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

function refreshCookie(response: LightMyRequestResponse) {
  return response.cookies.find((cookie) => cookie.name === "refresh_token");
}

describe("POST /api/auth/login", () => {
  it("returns an access token, a refresh token and the admin user", async () => {
    const response = await login();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
    expect(body.user).toEqual({ id: expect.any(String), email: ADMIN.email, role: "admin" });
  });

  it("logs the viewer in with the viewer role", async () => {
    const response = await login(VIEWER);

    expect(response.statusCode).toBe(200);
    expect(response.json().user.role).toBe("viewer");
  });

  it("sets the refresh token in an httpOnly, Secure, SameSite=Strict cookie scoped to /api/auth", async () => {
    const response = await login();

    const cookie = refreshCookie(response);
    expect(cookie?.value).toBe(response.json().refreshToken);
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/api/auth",
    });
  });

  it("treats the email as case-insensitive", async () => {
    const response = await login({ email: "Admin@FastMeals.com", password: ADMIN.password });

    expect(response.statusCode).toBe(200);
  });

  it("rejects a wrong password with INVALID_CREDENTIALS", async () => {
    const response = await login({ email: ADMIN.email, password: "Wrong@123" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "Email ou senha inválidos" },
    });
    expect(refreshCookie(response)).toBeUndefined();
  });

  it("gives an unknown email the same answer as a wrong password", async () => {
    const response = await login({ email: "nobody@fastmeals.com", password: ADMIN.password });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("INVALID_CREDENTIALS");
  });

  it("validates the body with field-level details", async () => {
    const response = await login({ email: "not-an-email", password: "" });

    expect(response.statusCode).toBe(400);
    const { error } = response.json();
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([
        { field: "email", message: "Informe um email válido" },
        { field: "password", message: "Informe a senha" },
      ]),
    );
  });
});

describe("autenticação: token válido e token inválido", () => {
  it("accepts a valid access token", async () => {
    const { accessToken } = await loginTokens();

    const response = await me(accessToken);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ email: ADMIN.email, role: "admin" });
  });

  it("rejects a malformed token with INVALID_TOKEN", async () => {
    const response = await me("not.a.jwt");

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("INVALID_TOKEN");
  });

  it("rejects a request without the Authorization header", async () => {
    const response = await app.inject("/api/auth/me");

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("INVALID_TOKEN");
  });

  it("rejects a token signed with another secret", async () => {
    const { user } = await loginTokens();
    const forged = createSigner({ key: "attacker-secret-that-is-at-least-32-chars" })({
      sub: user.id,
      role: "admin",
    });

    const response = await me(forged);

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("INVALID_TOKEN");
  });

  it("does not accept a refresh token as an access token", async () => {
    const { refreshToken } = await loginTokens();

    const response = await me(refreshToken);

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("INVALID_TOKEN");
  });

  it("tells an expired token apart with TOKEN_EXPIRED", async () => {
    const { user } = await loginTokens();
    const expired = createSigner({
      key: testEnv.JWT_SECRET,
      expiresIn: 15 * 60 * 1000,
      clockTimestamp: Date.now() - 16 * 60 * 1000,
    })({ sub: user.id, role: "admin" });

    const response = await me(expired);

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "TOKEN_EXPIRED", message: "Token de acesso expirado" },
    });
  });
});

describe("POST /api/auth/refresh", () => {
  it("rotates the refresh token and issues a working access token", async () => {
    const first = await loginTokens();

    const response = await refresh(first.refreshToken);

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.refreshToken).not.toBe(first.refreshToken);
    expect(body.user).toMatchObject({ email: ADMIN.email, role: "admin" });
    expect(refreshCookie(response)?.value).toBe(body.refreshToken);
    expect((await me(body.accessToken)).statusCode).toBe(200);
  });

  it("reads the token from the cookie when the body has none", async () => {
    const loginResponse = await login();
    const cookie = refreshCookie(loginResponse);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { refresh_token: cookie?.value ?? "" },
    });

    expect(response.statusCode).toBe(200);
  });

  it("rejects a missing, malformed or unknown token with INVALID_REFRESH_TOKEN", async () => {
    const { refreshToken } = await loginTokens();
    await db.delete(refreshTokens);

    for (const response of [
      await app.inject({ method: "POST", url: "/api/auth/refresh" }),
      await refresh("garbage"),
      await refresh(refreshToken),
    ]) {
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("INVALID_REFRESH_TOKEN");
    }
  });

  it("rejects an expired refresh token", async () => {
    const { refreshToken } = await loginTokens();
    await db.execute(sql`update refresh_tokens set expires_at = now() - interval '1 second'`);

    const response = await refresh(refreshToken);

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("lets only one of several simultaneous refreshes with the same token succeed", async () => {
    const { refreshToken } = await loginTokens();
    // Abre todas as conexões do pool antes. Sem isso, a primeira requisição usa a conexão
    // que já existe e termina antes de as outras se conectarem: não haveria disputa.
    await Promise.all(Array.from({ length: 10 }, () => pool.query("select pg_sleep(0.05)")));

    const responses = await Promise.all(Array.from({ length: 20 }, () => refresh(refreshToken)));

    const succeeded = responses.filter((response) => response.statusCode === 200);
    expect(succeeded).toHaveLength(1);
    expect(responses.filter((response) => response.statusCode === 401)).toHaveLength(19);
    // Dentro da janela de tolerância: a sessão continua viva para quem venceu.
    expect((await refresh(succeeded[0]?.json().refreshToken)).statusCode).toBe(200);
  });

  it("revokes the whole session when a rotated token is reused", async () => {
    const stolen = (await loginTokens()).refreshToken;
    const rotated = (await refresh(stolen)).json().refreshToken;
    // Simula o reuso depois da janela de tolerância entre abas.
    await db.execute(sql`update refresh_tokens set used_at = now() - interval '1 minute'
      where used_at is not null`);

    const reuse = await refresh(stolen);
    const afterReuse = await refresh(rotated);

    expect(reuse.statusCode).toBe(401);
    expect(afterReuse.statusCode).toBe(401);
    expect(afterReuse.json().error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("keeps other sessions of the same user alive when one is revoked", async () => {
    const laptop = (await loginTokens()).refreshToken;
    const phone = (await loginTokens()).refreshToken;
    await refresh(laptop);
    await db.execute(sql`update refresh_tokens set used_at = now() - interval '1 minute'
      where used_at is not null`);

    await refresh(laptop);

    expect((await refresh(phone)).statusCode).toBe(200);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the session and clears the cookie", async () => {
    const { refreshToken } = await loginTokens();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { refresh_token: refreshToken },
    });

    expect(response.statusCode).toBe(204);
    expect(refreshCookie(response)).toMatchObject({ value: "", path: "/api/auth" });
    expect((await refresh(refreshToken)).statusCode).toBe(401);
  });

  it("succeeds without a token", async () => {
    const response = await app.inject({ method: "POST", url: "/api/auth/logout" });

    expect(response.statusCode).toBe(204);
  });
});

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describe("defense in depth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores only the SHA-256 of the refresh token, never the token itself", async () => {
    const { refreshToken } = await loginTokens();

    const stored = await db.select({ tokenHash: refreshTokens.tokenHash }).from(refreshTokens);

    expect(stored).toEqual([{ tokenHash: sha256(refreshToken) }]);
  });

  // Medir tempo seria instável no CI; verificar que o bcrypt roda prova a mesma coisa:
  // sem o hash fictício, o email inexistente responderia sem os ~250 ms do bcrypt.
  it("runs bcrypt even when the email does not exist, so timing does not reveal accounts", async () => {
    const compare = vi.spyOn(bcrypt, "compare");

    await login({ email: "nobody@fastmeals.com", password: "Admin@123" });

    expect(compare).toHaveBeenCalledOnce();
    expect(compare.mock.calls[0]?.[1]).toMatch(/^\$2b\$12\$/);
  });

  it("rejects an access token without expiration, even with a valid signature", async () => {
    const { user } = await loginTokens();
    const neverExpires = createSigner({ key: testEnv.JWT_SECRET })({
      sub: user.id,
      role: "admin",
    });

    const response = await me(neverExpires);

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("INVALID_TOKEN");
  });

  it("rejects a refresh token without expiration, even when it is in the database", async () => {
    const { user } = await loginTokens();
    const familyId = randomUUID();
    const neverExpires = createSigner({ key: testEnv.JWT_REFRESH_SECRET })({
      sub: user.id,
      fam: familyId,
      jti: randomUUID(),
    });
    await db.insert(refreshTokens).values({
      userId: user.id,
      familyId,
      tokenHash: sha256(neverExpires),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await refresh(neverExpires);

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("deletes the user's expired refresh tokens on the next login", async () => {
    const { user } = await loginTokens();
    await db.execute(sql`update refresh_tokens set expires_at = now() - interval '1 second'`);

    await loginTokens();

    const expired = await db
      .select({ id: refreshTokens.id })
      .from(refreshTokens)
      .where(sql`${refreshTokens.expiresAt} < now() and ${eq(refreshTokens.userId, user.id)}`);
    expect(expired).toHaveLength(0);
  });
});
