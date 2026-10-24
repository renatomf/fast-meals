import { drizzle } from "drizzle-orm/node-postgres";
import type pg from "pg";
import * as schema from "../models/index.ts";

export function createDatabase(client: pg.Pool | pg.PoolClient) {
  return drizzle({ client, schema });
}

export type Database = ReturnType<typeof createDatabase>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
// Repositórios recebem um ou outro: quem decide se há transação é o service.
export type Executor = Database | Transaction;
