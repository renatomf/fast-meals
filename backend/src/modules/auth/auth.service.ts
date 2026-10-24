import { createHash, randomUUID } from "node:crypto";
import { userRoleSchema, type AuthUser, type UserRole } from "@fastmeals/contracts";
import bcrypt from "bcrypt";
import { createSigner, createVerifier, TokenError } from "fast-jwt";
import { z } from "zod";
import type { Database, Executor } from "../../db/client.ts";
import { AppError } from "../../utils/app-error.ts";
import type { AuthRepository } from "./auth.repository.ts";
import type { LoginThrottle } from "./login-throttle.ts";

// Hash bcrypt (custo 12) de uma senha aleatória descartada. Comparar contra ele quando o
// email não existe faz o login levar o mesmo tempo nos dois casos: a latência deixa de
// revelar quais emails estão cadastrados.
const DUMMY_PASSWORD_HASH = "$2b$12$W9RsVBh4okdlHqz4NkDu9eRTScgMtR57umAQZHmistIWzx01LTSue";

// Duas abas renovando ao mesmo tempo apresentam o mesmo token, e a segunda chega depois
// da rotação. Dentro desta janela ela só recebe 401 e pode tentar de novo com o cookie
// novo. Fora dela, um token já usado reaparecendo é tratado como roubo.
export const REUSE_GRACE_MS = 10_000;

const accessClaimsSchema = z.object({ sub: z.uuid(), role: userRoleSchema });

export type RequestUser = { id: string; role: UserRole };

export type Session = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: AuthUser;
};

type TokenSettings = { secret: string; ttlMs: number };

type AuthServiceOptions = {
  db: Database;
  repository: AuthRepository;
  accessToken: TokenSettings;
  refreshToken: TokenSettings;
  loginThrottle: LoginThrottle;
  securityLog: { warn: (details: object, message: string) => void };
};

type RefreshOutcome =
  { ok: true; session: Session } | { ok: false; reuse?: { userId: string; familyId: string } };

const invalidCredentials = () =>
  new AppError(401, "INVALID_CREDENTIALS", "Email ou senha inválidos");
const invalidRefreshToken = () =>
  new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token inválido ou expirado");
const invalidAccessToken = () => new AppError(401, "INVALID_TOKEN", "Token de acesso inválido");
const tooManyFailures = (blockedForMs: number) =>
  new AppError(
    429,
    "RATE_LIMIT_EXCEEDED",
    `Muitas tentativas de login para este email. Tente novamente em ${Math.ceil(blockedForMs / 60_000)} min.`,
  );

function sha256(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAuthService({
  db,
  repository,
  accessToken,
  refreshToken,
  loginThrottle,
  securityLog,
}: AuthServiceOptions) {
  const signAccessToken = createSigner({
    key: accessToken.secret,
    algorithm: "HS256",
    expiresIn: accessToken.ttlMs,
  });
  const verifyAccess = createVerifier({
    key: accessToken.secret,
    algorithms: ["HS256"],
    requiredClaims: ["exp"],
  });
  const signRefreshToken = createSigner({
    key: refreshToken.secret,
    algorithm: "HS256",
    expiresIn: refreshToken.ttlMs,
  });
  const verifyRefresh = createVerifier({
    key: refreshToken.secret,
    algorithms: ["HS256"],
    requiredClaims: ["exp"],
  });

  async function startSession(
    executor: Executor,
    user: AuthUser,
    familyId: string,
  ): Promise<Session> {
    // jti garante tokens distintos mesmo emitidos no mesmo segundo para a mesma família.
    const token = signRefreshToken({ sub: user.id, fam: familyId, jti: randomUUID() });
    const expiresAt = new Date(Date.now() + refreshToken.ttlMs);
    await repository.insertRefreshToken(executor, {
      userId: user.id,
      familyId,
      tokenHash: sha256(token),
      expiresAt,
    });
    return {
      accessToken: signAccessToken({ sub: user.id, role: user.role }),
      refreshToken: token,
      refreshTokenExpiresAt: expiresAt,
      user,
    };
  }

  async function login(email: string, password: string): Promise<Session> {
    // Bloqueado até para a senha certa: senão o atacante continuaria tentando e saberia
    // quando acertou. Vale para qualquer email, existente ou não, e não revela contas.
    const blockedForMs = loginThrottle.blockedForMs(email);
    if (blockedForMs > 0) throw tooManyFailures(blockedForMs);

    const user = await repository.findUserByEmail(db, email);
    const passwordMatches = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) {
      if (loginThrottle.recordFailure(email)) {
        securityLog.warn({ email }, "login blocked for this email after repeated failures");
      }
      throw invalidCredentials();
    }
    loginThrottle.reset(email);

    return db.transaction(async (tx) => {
      await repository.deleteExpiredTokens(tx, user.id, new Date());
      return startSession(tx, { id: user.id, email: user.email, role: user.role }, randomUUID());
    });
  }

  async function refresh(presentedToken: string | undefined): Promise<Session> {
    if (!presentedToken) throw invalidRefreshToken();
    try {
      verifyRefresh(presentedToken);
    } catch {
      throw invalidRefreshToken();
    }

    // A revogação da família precisa ser gravada antes do 401: por isso a transação
    // devolve o resultado em vez de lançar o erro lá dentro, o que desfaria o UPDATE.
    const outcome = await db.transaction(async (tx): Promise<RefreshOutcome> => {
      const stored = await repository.findRefreshTokenForUpdate(tx, sha256(presentedToken));
      const now = new Date();
      if (!stored || stored.revokedAt || stored.expiresAt <= now) return { ok: false };

      if (stored.usedAt) {
        if (now.getTime() - stored.usedAt.getTime() < REUSE_GRACE_MS) return { ok: false };
        await repository.revokeFamily(tx, stored.familyId, now);
        return { ok: false, reuse: { userId: stored.userId, familyId: stored.familyId } };
      }

      const user = await repository.findUserById(tx, stored.userId);
      if (!user) return { ok: false };
      await repository.markRefreshTokenUsed(tx, stored.id, now);
      return { ok: true, session: await startSession(tx, user, stored.familyId) };
    });

    if (outcome.ok) return outcome.session;
    if (outcome.reuse) {
      securityLog.warn(
        outcome.reuse,
        "refresh token reused after rotation; session family revoked",
      );
    }
    throw invalidRefreshToken();
  }

  // Sem token, ou com um token desconhecido, não há o que revogar: logout é idempotente.
  async function logout(presentedToken: string | undefined): Promise<void> {
    if (!presentedToken) return;
    const stored = await repository.findRefreshToken(db, sha256(presentedToken));
    if (stored) await repository.revokeFamily(db, stored.familyId, new Date());
  }

  function verifyAccessToken(token: string): RequestUser {
    let payload: unknown;
    try {
      payload = verifyAccess(token);
    } catch (error) {
      if (error instanceof TokenError && error.code === TokenError.codes.expired) {
        throw new AppError(401, "TOKEN_EXPIRED", "Token de acesso expirado");
      }
      throw invalidAccessToken();
    }
    const claims = accessClaimsSchema.safeParse(payload);
    if (!claims.success) throw invalidAccessToken();
    return { id: claims.data.sub, role: claims.data.role };
  }

  async function currentUser(id: string): Promise<AuthUser> {
    const user = await repository.findUserById(db, id);
    // Token válido de um usuário que não existe mais.
    if (!user) throw invalidAccessToken();
    return user;
  }

  return { login, refresh, logout, verifyAccessToken, currentUser };
}

export type AuthService = ReturnType<typeof createAuthService>;
