import { and, eq, isNull, lt } from "drizzle-orm";
import type { Executor } from "../../db/client.ts";
import { refreshTokens, users } from "../../models/index.ts";

export type StoredRefreshToken = typeof refreshTokens.$inferSelect;

async function findUserByEmail(db: Executor, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}

async function findUserById(db: Executor, id: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user;
}

async function insertRefreshToken(db: Executor, token: typeof refreshTokens.$inferInsert) {
  await db.insert(refreshTokens).values(token);
}

// FOR UPDATE: duas renovações simultâneas com o mesmo token ficam em fila, e a
// segunda já enxerga o used_at gravado pela primeira.
async function findRefreshTokenForUpdate(db: Executor, tokenHash: string) {
  const [token] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .for("update");
  return token;
}

async function findRefreshToken(db: Executor, tokenHash: string) {
  const [token] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));
  return token;
}

async function markRefreshTokenUsed(db: Executor, id: string, at: Date) {
  await db.update(refreshTokens).set({ usedAt: at }).where(eq(refreshTokens.id, id));
}

async function revokeFamily(db: Executor, familyId: string, at: Date) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: at })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

async function deleteExpiredTokens(db: Executor, userId: string, before: Date) {
  await db
    .delete(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), lt(refreshTokens.expiresAt, before)));
}

export const authRepository = {
  findUserByEmail,
  findUserById,
  insertRefreshToken,
  findRefreshTokenForUpdate,
  findRefreshToken,
  markRefreshTokenUsed,
  revokeFamily,
  deleteExpiredTokens,
};

export type AuthRepository = typeof authRepository;
