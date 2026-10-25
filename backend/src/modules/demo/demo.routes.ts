import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authorize } from "../../middlewares/auth.ts";
import {
  bearerSecurity as security,
  writeErrorResponses as writeErrors,
} from "../../utils/openapi.ts";
import { createDemoController } from "./demo.controller.ts";
import type { DemoService } from "./demo.service.ts";

type DemoRoutesOptions = { demoService: DemoService };

export const demoRoutes: FastifyPluginAsyncZod<DemoRoutesOptions> = async (
  app,
  { demoService },
) => {
  const controller = createDemoController(demoService);

  app.post(
    "/dispatch/demo-scenario",
    {
      preValidation: authorize("admin"),
      schema: {
        tags: ["dispatch"],
        summary: "Cria um cenário em que o guloso perde do Húngaro (admin, só com DEMO_MODE)",
        description:
          "Cria 8 entregadores e 8 pedidos ready em quatro bairros, em armadilhas onde o par " +
          "mais próximo força um par distante. Chamar de novo substitui o cenário anterior.",
        security,
        response: {
          201: z.object({ orders: z.number().int(), deliveryPersons: z.number().int() }),
          ...writeErrors,
        },
      },
    },
    (request, reply) => controller.createScenario(request, reply),
  );
};
