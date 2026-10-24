import { sql, type SQL } from "drizzle-orm";
import { timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// O valor é mantido pelo trigger set_updated_at; o default cobre só o INSERT.
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const deletedAt = () => timestamp("deleted_at", { withTimezone: true });

// CHECK (coluna IN (...)) a partir das listas de contracts, para que banco e API
// aceitem exatamente os mesmos valores. As listas são constantes do código, nunca entrada.
export function oneOf(column: AnyPgColumn, values: readonly string[]): SQL {
  return sql`${column} in (${sql.raw(values.map((value) => `'${value}'`).join(", "))})`;
}
