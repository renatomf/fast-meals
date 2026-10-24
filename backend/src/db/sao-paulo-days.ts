import { and, gte, lt, sql, type AnyColumn, type SQL } from "drizzle-orm";

// Datas de filtro (YYYY-MM-DD) são dias de São Paulo: "2025-01-12" vai de 00:00 a 23:59:59
// locais, ou seja, de 03:00 do dia 12 a 02:59:59 do dia 13 em UTC. Agrupar ou filtrar pelo
// dia UTC jogaria as vendas do jantar no dia seguinte.
export const SAO_PAULO = "America/Sao_Paulo";

export function startOfDay(date: string): SQL {
  return sql`(${date}::date)::timestamp at time zone ${sql.raw(`'${SAO_PAULO}'`)}`;
}

export function startOfNextDay(date: string): SQL {
  return sql`((${date}::date + 1)::timestamp at time zone ${sql.raw(`'${SAO_PAULO}'`)})`;
}

// Intervalo fechado nas duas pontas, em dias locais; sem datas, sem filtro.
export function withinDays(
  column: AnyColumn,
  { startDate, endDate }: { startDate?: string | undefined; endDate?: string | undefined },
): SQL | undefined {
  return and(
    startDate ? gte(column, startOfDay(startDate)) : undefined,
    endDate ? lt(column, startOfNextDay(endDate)) : undefined,
  );
}
