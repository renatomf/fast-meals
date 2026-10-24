import {
  orderStatuses,
  vehicleTypes,
  type AverageDeliveryTimeReport,
  type OrdersByStatusReport,
  type PeriodQuery,
  type RevenueQuery,
  type RevenueReport,
  type TopProductsQuery,
  type TopProductsReport,
} from "@fastmeals/contracts";
import type { Database } from "../../db/client.ts";
import { toCents } from "../../utils/money.ts";
import type { ReportsRepository } from "./reports.repository.ts";

type ReportsServiceOptions = {
  db: Database;
  repository: ReportsRepository;
};

const oneDecimal = (value: number) => Math.round(value * 10) / 10;
const centsToNumber = (cents: number) => cents / 100;

export function createReportsService({ db, repository }: ReportsServiceOptions) {
  // Somas em centavos inteiros: a soma dos dias bate exatamente com o total.
  async function revenue({ startDate, endDate }: RevenueQuery): Promise<RevenueReport> {
    const days = await repository.dailyRevenue(db, startDate, endDate);
    const dailyRevenue = days.map((day) => ({
      date: day.date,
      revenueCents: toCents(day.revenue),
      orders: day.orders,
    }));
    const totalCents = dailyRevenue.reduce((sum, day) => sum + day.revenueCents, 0);
    const totalOrders = dailyRevenue.reduce((sum, day) => sum + day.orders, 0);
    return {
      startDate,
      endDate,
      totalRevenue: centsToNumber(totalCents),
      totalOrders,
      averageOrderValue:
        totalOrders === 0 ? 0 : centsToNumber(Math.round(totalCents / totalOrders)),
      dailyRevenue: dailyRevenue.map((day) => ({
        date: day.date,
        revenue: centsToNumber(day.revenueCents),
        orders: day.orders,
      })),
    };
  }

  // Todos os status aparecem, mesmo com zero: o gráfico não muda de forma entre períodos.
  async function ordersByStatus(period: PeriodQuery): Promise<OrdersByStatusReport> {
    const counts = new Map(
      (await repository.ordersByStatus(db, period)).map((row) => [row.status, row.count]),
    );
    const data = orderStatuses.map((status) => ({ status, count: counts.get(status) ?? 0 }));
    return { data, total: data.reduce((sum, row) => sum + row.count, 0) };
  }

  async function topProducts({ limit, ...period }: TopProductsQuery): Promise<TopProductsReport> {
    const rows = await repository.topProducts(db, period, limit);
    return {
      data: rows.map((row) => ({
        ...row,
        totalRevenue: centsToNumber(toCents(row.totalRevenue)),
      })),
    };
  }

  async function averageDeliveryTime(period: PeriodQuery): Promise<AverageDeliveryTimeReport> {
    const rows = await repository.deliveryTimes(db, period);
    const overall = rows.find((row) => row.grouped === 1);
    const byVehicle = new Map(
      rows.filter((row) => row.grouped === 0).map((row) => [row.vehicleType, row]),
    );
    return {
      averageMinutes: oneDecimal(overall?.averageMinutes ?? 0),
      fastestMinutes: oneDecimal(overall?.fastestMinutes ?? 0),
      slowestMinutes: oneDecimal(overall?.slowestMinutes ?? 0),
      totalDelivered: overall?.count ?? 0,
      // Os três veículos sempre aparecem, como os status no relatório acima.
      byVehicleType: vehicleTypes.map((vehicleType) => {
        const row = byVehicle.get(vehicleType);
        return {
          vehicleType,
          averageMinutes: oneDecimal(row?.averageMinutes ?? 0),
          count: row?.count ?? 0,
        };
      }),
    };
  }

  return { revenue, ordersByStatus, topProducts, averageDeliveryTime };
}

export type ReportsService = ReturnType<typeof createReportsService>;
