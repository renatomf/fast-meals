import {
  optimizeAssignmentQuerySchema,
  optimizeAssignmentResponseSchema,
} from "@fastmeals/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authorize } from "../../middlewares/auth.ts";
import {
  bearerSecurity as security,
  writeErrorResponses as writeErrors,
} from "../../utils/openapi.ts";
import { createDispatchController } from "./dispatch.controller.ts";
import type { DispatchService } from "./dispatch.service.ts";

type DispatchRoutesOptions = { dispatchService: DispatchService };

export const dispatchRoutes: FastifyPluginAsyncZod<DispatchRoutesOptions> = async (
  app,
  { dispatchService },
) => {
  const controller = createDispatchController(dispatchService);

  app.post(
    "/orders/optimize-assignment",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["dispatch"],
        summary: "Sugere a atribuição de entregadores que minimiza a distância total (admin)",
        description:
          "Algoritmo Húngaro sobre a matriz de distâncias (Haversine) entre pedidos ready sem " +
          "entregador e entregadores ativos, livres e com localização. Só sugere: aceitar é " +
          "PATCH /orders/:id/assign seguido de PATCH /orders/:id/status. Traz o total do " +
          "guloso para comparação e, com includeMatrix=true, a matriz de distâncias.",
        security,
        querystring: optimizeAssignmentQuerySchema,
        response: { 200: optimizeAssignmentResponseSchema, ...writeErrors },
      },
    },
    (request, reply) => controller.optimize(request, reply),
  );
};
