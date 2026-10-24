import { char, index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "./columns.ts";
import { users } from "./users.ts";

// Guarda só o SHA-256 do token: um vazamento do banco não entrega sessões válidas.
// Todos os tokens nascidos do mesmo login compartilham family_id; reapresentar um token
// já usado revoga a família inteira (ADR 0004).
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    tokenHash: char("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_refresh_tokens_family_id").on(t.familyId),
    index("idx_refresh_tokens_user_id").on(t.userId),
  ],
);
