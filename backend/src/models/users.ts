import { userRoles, type UserRole } from "@fastmeals/contracts";
import { check, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, oneOf, updatedAt } from "./columns.ts";

// Sem idx_users_email do schema de referência: a constraint UNIQUE já cria esse índice.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).$type<UserRole>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("users_role_check", oneOf(t.role, userRoles))],
);
