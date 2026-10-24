import type {
  AverageDeliveryTimeReport,
  OrdersByStatusReport,
  PeriodQuery,
  RevenueQuery,
  RevenueReport,
  TopProductsQuery,
  TopProductsReport,
} from "@fastmeals/contracts";
import type { FastifyRequest } from "fastify";
import type { ReportsService } from "./reports.service.ts";

export function createReportsController(reportsService: ReportsService) {
  return {
    revenue: (request: FastifyRequest<{ Querystring: RevenueQuery }>): Promise<RevenueReport> =>
      reportsService.revenue(request.query),

    ordersByStatus: (
      request: FastifyRequest<{ Querystring: PeriodQuery }>,
    ): Promise<OrdersByStatusReport> => reportsService.ordersByStatus(request.query),

    topProducts: (
      request: FastifyRequest<{ Querystring: TopProductsQuery }>,
    ): Promise<TopProductsReport> => reportsService.topProducts(request.query),

    averageDeliveryTime: (
      request: FastifyRequest<{ Querystring: PeriodQuery }>,
    ): Promise<AverageDeliveryTimeReport> => reportsService.averageDeliveryTime(request.query),
  };
}
