import type { OrderStatus, PeriodQuery, VehicleType } from "@fastmeals/contracts";
import { and, sql, type SQL } from "drizzle-orm";
import type { Executor } from "../../db/client.ts";
import { SAO_PAULO, startOfDay, startOfNextDay } from "../../db/sao-paulo-days.ts";

// SQL escrito à mão: agregações, generate_series e GROUPING SETS ficam mais claros assim
// do que pelo query builder. Toda entrada chega como parâmetro; sql.raw só recebe a
// constante do fuso.

const localDay = sql.raw(`(o.created_at at time zone '${SAO_PAULO}')::date`);

function periodFilter({ startDate, endDate }: PeriodQuery) {
  return and(
    startDate ? sql`o.created_at >= ${startOfDay(startDate)}` : undefined,
    endDate ? sql`o.created_at < ${startOfNextDay(endDate)}` : undefined,
  );
}

function whereClause(...conditions: (SQL | undefined)[]) {
  const combined = and(...conditions);
  return combined ? sql`where ${combined}` : sql``;
}

// Uma linha por dia do período, com zero nos dias sem venda.
async function dailyRevenue(db: Executor, startDate: string, endDate: string) {
  const { rows } = await db.execute<{ date: string; revenue: string; orders: number }>(sql`
    with days as (
      select generate_series(${startDate}::date, ${endDate}::date, interval '1 day')::date as day
    ),
    delivered as (
      select ${localDay} as day, o.total_amount
      from orders o
      ${whereClause(sql`o.status = 'delivered'`, periodFilter({ startDate, endDate }))}
    )
    select to_char(days.day, 'YYYY-MM-DD') as date,
           coalesce(sum(delivered.total_amount), 0)::text as revenue,
           count(delivered.total_amount)::int as orders
    from days left join delivered on delivered.day = days.day
    group by days.day
    order by days.day`);
  return rows;
}

async function ordersByStatus(db: Executor, period: PeriodQuery) {
  const { rows } = await db.execute<{ status: OrderStatus; count: number }>(sql`
    select o.status, count(*)::int as count
    from orders o
    ${whereClause(periodFilter(period))}
    group by o.status`);
  return rows;
}

// Receita pelo preço gravado no item (unit_price), não pelo preço atual do produto.
async function topProducts(db: Executor, period: PeriodQuery, limit: number) {
  const { rows } = await db.execute<{
    productId: string;
    productName: string;
    totalQuantity: number;
    totalRevenue: string;
  }>(sql`
    select p.id as "productId",
           p.name as "productName",
           sum(oi.quantity)::int as "totalQuantity",
           sum(oi.quantity * oi.unit_price)::text as "totalRevenue"
    from order_items oi
    join orders o on o.id = oi.order_id
    join products p on p.id = oi.product_id
    ${whereClause(sql`o.status = 'delivered'`, periodFilter(period))}
    group by p.id, p.name
    order by sum(oi.quantity) desc, sum(oi.quantity * oi.unit_price) desc, p.name asc
    limit ${limit}`);
  return rows;
}

// GROUPING SETS calcula numa passada o total geral (vehicle_type nulo, grouped = 1) e o
// total por veículo. O tempo vai da criação do pedido à transição para delivered,
// registrada em order_status_history.
async function deliveryTimes(db: Executor, period: PeriodQuery) {
  const { rows } = await db.execute<{
    vehicleType: VehicleType | null;
    grouped: number;
    averageMinutes: number | null;
    fastestMinutes: number | null;
    slowestMinutes: number | null;
    count: number;
  }>(sql`
    with deliveries as (
      select dp.vehicle_type, extract(epoch from (h.changed_at - o.created_at)) / 60 as minutes
      from orders o
      join order_status_history h on h.order_id = o.id and h.to_status = 'delivered'
      left join delivery_persons dp on dp.id = o.delivery_person_id
      ${whereClause(sql`o.status = 'delivered'`, periodFilter(period))}
    )
    select vehicle_type as "vehicleType",
           grouping(vehicle_type)::int as grouped,
           avg(minutes)::float8 as "averageMinutes",
           min(minutes)::float8 as "fastestMinutes",
           max(minutes)::float8 as "slowestMinutes",
           count(*)::int as count
    from deliveries
    group by grouping sets ((), (vehicle_type))`);
  return rows;
}

export const reportsRepository = { dailyRevenue, ordersByStatus, topProducts, deliveryTimes };

export type ReportsRepository = typeof reportsRepository;
