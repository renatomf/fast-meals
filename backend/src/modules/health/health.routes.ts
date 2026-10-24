import { healthResponseSchema } from "@fastmeals/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

type HealthRoutesOptions = {
  checkDatabase: () => Promise<boolean>;
};

export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (
  app,
  { checkDatabase },
) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        summary: "Verifica se a API e o banco estão respondendo",
        response: { 200: healthResponseSchema, 503: healthResponseSchema },
      },
    },
    async (_request, reply) => {
      const databaseUp = await checkDatabase();
      return reply.status(databaseUp ? 200 : 503).send({
        status: databaseUp ? "ok" : "degraded",
        database: databaseUp ? "up" : "down",
        uptimeSeconds: Math.round(process.uptime()),
      });
    },
  );
};
