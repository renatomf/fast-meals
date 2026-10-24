import pg from "pg";

type DatabaseLimits = Pick<
  pg.PoolConfig,
  "statement_timeout" | "idle_in_transaction_session_timeout" | "connectionTimeoutMillis"
>;

// Proteção contra travamento, não meta de desempenho: as listagens miram < 200 ms e a
// otimização < 2 s. Sem limite, dez consultas presas esgotam o pool e a API inteira para.
// Só a API usa estes valores: migrations e seeds criam o pool sem eles, porque um
// CREATE INDEX numa tabela grande pode levar mais que isso legitimamente.
export const apiDatabaseLimits: DatabaseLimits = {
  // Cada consulta; o PostgreSQL cancela a que passar disso.
  statement_timeout: 10_000,
  // Transação aberta e esquecida segurando locks.
  idle_in_transaction_session_timeout: 15_000,
  // Espera por uma conexão livre, ou pelo banco fora do ar: falha em vez de pendurar.
  connectionTimeoutMillis: 5_000,
};

export function createPool(connectionString: string, limits: DatabaseLimits = {}): pg.Pool {
  return new pg.Pool({ connectionString, max: 10, ...limits });
}

export async function pingDatabase(pool: pg.Pool): Promise<boolean> {
  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  }
}
