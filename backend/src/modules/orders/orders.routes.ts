import {
  assignDeliveryPersonSchema,
  createOrderSchema,
  errorResponseSchema,
  idParamsSchema,
  listOrdersQuerySchema,
  orderHistorySchema,
  orderListSchema,
  orderSchema,
  updateOrderStatusSchema,
} from "@fastmeals/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authorize } from "../../middlewares/auth.ts";
import { createOrdersController } from "./orders.controller.ts";
import type { OrdersService } from "./orders.service.ts";

type OrdersRoutesOptions = { ordersService: OrdersService };

const security = [{ bearerAuth: [] }];
const readErrors = { 400: errorResponseSchema, 401: errorResponseSchema };
const writeErrors = { ...readErrors, 403: errorResponseSchema };

export const ordersRoutes: FastifyPluginAsyncZod<OrdersRoutesOptions> = async (
  app,
  { ordersService },
) => {
  const controller = createOrdersController(ordersService);
  const adminOnly = authorize("admin");

  app.get(
    "/orders",
    {
      schema: {
        tags: ["orders"],
        summary: "Lista pedidos com paginação, filtros de status e período e ordenação",
        description: "startDate e endDate (YYYY-MM-DD) são dias de São Paulo, inclusive.",
        security,
        querystring: listOrdersQuerySchema,
        response: { 200: orderListSchema, ...readErrors },
      },
    },
    (request) => controller.list(request),
  );

  app.get(
    "/orders/:id",
    {
      schema: {
        tags: ["orders"],
        summary: "Detalhe de um pedido",
        security,
        params: idParamsSchema,
        response: { 200: orderSchema, 404: errorResponseSchema, ...readErrors },
      },
    },
    (request) => controller.get(request),
  );

  app.get(
    "/orders/:id/history",
    {
      schema: {
        tags: ["orders"],
        summary: "Linha do tempo de status do pedido, com autor de cada mudança",
        security,
        params: idParamsSchema,
        response: { 200: orderHistorySchema, 404: errorResponseSchema, ...readErrors },
      },
    },
    (request) => controller.history(request),
  );

  app.post(
    "/orders",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["orders"],
        summary: "Cria um pedido (admin)",
        description:
          "O total é calculado no servidor com os preços atuais, gravados em cada item. " +
          "Produtos inexistentes ou indisponíveis: 422 UNAVAILABLE_PRODUCT com details.",
        security,
        body: createOrderSchema,
        response: { 201: orderSchema, 422: errorResponseSchema, ...writeErrors },
      },
    },
    (request, reply) => controller.create(request, reply),
  );

  app.patch(
    "/orders/:id/status",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["orders"],
        summary: "Altera o status de um pedido (admin)",
        description:
          "Só as 7 transições do enunciado; outras dão 422 INVALID_STATUS_TRANSITION. " +
          "ready → delivering exige entregador. 409 ORDER_CONFLICT se outra operação mudou o pedido antes.",
        security,
        params: idParamsSchema,
        body: updateOrderStatusSchema,
        response: {
          200: orderSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema,
          ...writeErrors,
        },
      },
    },
    (request) => controller.changeStatus(request),
  );

  app.patch(
    "/orders/:id/assign",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["orders"],
        summary: "Atribui um entregador a um pedido pronto (admin)",
        description:
          "O entregador precisa estar ativo e sem outro pedido ready ou delivering " +
          "(422 DELIVERY_PERSON_UNAVAILABLE). Só pedidos ready (422 ORDER_NOT_ASSIGNABLE).",
        security,
        params: idParamsSchema,
        body: assignDeliveryPersonSchema,
        response: {
          200: orderSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema,
          ...writeErrors,
        },
      },
    },
    (request) => controller.assign(request),
  );
};
