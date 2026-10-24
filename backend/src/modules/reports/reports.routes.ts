import {
  averageDeliveryTimeReportSchema,
  ordersByStatusReportSchema,
  periodQuerySchema,
  revenueQuerySchema,
  revenueReportSchema,
  topProductsQuerySchema,
  topProductsReportSchema,
} from "@fastmeals/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  bearerSecurity as security,
  readErrorResponses as readErrors,
} from "../../utils/openapi.ts";
import { createReportsController } from "./reports.controller.ts";
import type { ReportsService } from "./reports.service.ts";

type ReportsRoutesOptions = { reportsService: ReportsService };

const periodNote = "Período (YYYY-MM-DD) pela data de criação do pedido, em dias de São Paulo.";

export const reportsRoutes: FastifyPluginAsyncZod<ReportsRoutesOptions> = async (
  app,
  { reportsService },
) => {
  const controller = createReportsController(reportsService);

  app.get(
    "/reports/revenue",
    {
      schema: {
        tags: ["reports"],
        summary: "Receita dos pedidos entregues, com o valor de cada dia",
        description: `${periodNote} Datas obrigatórias, no máximo 366 dias; dias sem venda vêm com zero.`,
        security,
        querystring: revenueQuerySchema,
        response: { 200: revenueReportSchema, ...readErrors },
      },
    },
    (request) => controller.revenue(request),
  );

  app.get(
    "/reports/orders-by-status",
    {
      schema: {
        tags: ["reports"],
        summary: "Quantidade de pedidos em cada status",
        description: `${periodNote} Sem datas, considera todos os pedidos.`,
        security,
        querystring: periodQuerySchema,
        response: { 200: ordersByStatusReportSchema, ...readErrors },
      },
    },
    (request) => controller.ordersByStatus(request),
  );

  app.get(
    "/reports/top-products",
    {
      schema: {
        tags: ["reports"],
        summary: "Produtos mais vendidos em pedidos entregues",
        description: `${periodNote} Ordena por quantidade e desempata pela receita.`,
        security,
        querystring: topProductsQuerySchema,
        response: { 200: topProductsReportSchema, ...readErrors },
      },
    },
    (request) => controller.topProducts(request),
  );

  app.get(
    "/reports/average-delivery-time",
    {
      schema: {
        tags: ["reports"],
        summary: "Tempo entre a criação do pedido e a entrega, geral e por veículo",
        description: periodNote,
        security,
        querystring: periodQuerySchema,
        response: { 200: averageDeliveryTimeReportSchema, ...readErrors },
      },
    },
    (request) => controller.averageDeliveryTime(request),
  );
};
