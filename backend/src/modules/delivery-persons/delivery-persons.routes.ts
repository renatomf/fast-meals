import {
  createDeliveryPersonSchema,
  deliveryPersonListSchema,
  deliveryPersonSchema,
  errorResponseSchema,
  idParamsSchema,
  listDeliveryPersonsQuerySchema,
  updateDeliveryPersonSchema,
} from "@fastmeals/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authorize } from "../../middlewares/auth.ts";
import {
  bearerSecurity as security,
  readErrorResponses as readErrors,
  writeErrorResponses as writeErrors,
} from "../../utils/openapi.ts";
import { createDeliveryPersonsController } from "./delivery-persons.controller.ts";
import type { DeliveryPersonsService } from "./delivery-persons.service.ts";

type DeliveryPersonsRoutesOptions = { deliveryPersonsService: DeliveryPersonsService };

export const deliveryPersonsRoutes: FastifyPluginAsyncZod<DeliveryPersonsRoutesOptions> = async (
  app,
  { deliveryPersonsService },
) => {
  const controller = createDeliveryPersonsController(deliveryPersonsService);
  const adminOnly = authorize("admin");

  app.get(
    "/delivery-persons",
    {
      schema: {
        tags: ["delivery-persons"],
        summary: "Lista entregadores",
        description:
          "available=true devolve só quem não tem pedido ready nem delivering; currentOrderId é esse pedido.",
        security,
        querystring: listDeliveryPersonsQuerySchema,
        response: { 200: deliveryPersonListSchema, ...readErrors },
      },
    },
    (request) => controller.list(request),
  );

  app.get(
    "/delivery-persons/:id",
    {
      schema: {
        tags: ["delivery-persons"],
        summary: "Detalhe de um entregador",
        security,
        params: idParamsSchema,
        response: { 200: deliveryPersonSchema, 404: errorResponseSchema, ...readErrors },
      },
    },
    (request) => controller.get(request),
  );

  app.post(
    "/delivery-persons",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["delivery-persons"],
        summary: "Cadastra um entregador (admin)",
        security,
        body: createDeliveryPersonSchema,
        response: { 201: deliveryPersonSchema, ...writeErrors },
      },
    },
    (request, reply) => controller.create(request, reply),
  );

  app.put(
    "/delivery-persons/:id",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["delivery-persons"],
        summary: "Atualiza um entregador (admin); só os campos enviados mudam",
        security,
        params: idParamsSchema,
        body: updateDeliveryPersonSchema,
        response: { 200: deliveryPersonSchema, 404: errorResponseSchema, ...writeErrors },
      },
    },
    (request) => controller.update(request),
  );

  app.delete(
    "/delivery-persons/:id",
    {
      preHandler: adminOnly,
      schema: {
        tags: ["delivery-persons"],
        summary: "Remove um entregador (admin)",
        description:
          "Recusado com 409 DELIVERY_PERSON_IN_USE se ele tiver pedido ready ou delivering.",
        security,
        params: idParamsSchema,
        response: { 404: errorResponseSchema, 409: errorResponseSchema, ...writeErrors },
      },
    },
    (request, reply) => controller.remove(request, reply),
  );
};
