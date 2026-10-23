import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyServerOptions } from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Env } from "./config/env.ts";
import { healthRoutes } from "./modules/health/health.routes.ts";
import { errorHandler, notFoundHandler } from "./shared/errors/error-handler.ts";

export type AppDependencies = {
  env: Env;
  checkDatabase: () => Promise<boolean>;
};

function loggerOptions(env: Env): FastifyServerOptions["logger"] {
  if (env.NODE_ENV === "test") return false;
  return {
    level: env.LOG_LEVEL,
    redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
    ...(env.NODE_ENV === "development" && {
      transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } },
    }),
  };
}

// Composition root: todas as dependências entram por aqui, o que permite
// montar a aplicação nos testes com fakes no lugar do banco.
export async function buildApp({ env, checkDatabase }: AppDependencies) {
  const app = Fastify({
    logger: loggerOptions(env),
    requestIdHeader: "x-request-id",
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // CSP é uma política de documento; a API só devolve JSON. O front recebe CSP do nginx
  // e o Swagger UI declara a própria via staticCSP.
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "FastMeals API",
        description: "API de gestão de pedidos, cardápio, entregadores e despacho.",
        version: "1.0.0",
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/api/docs", staticCSP: true });

  await app.register(healthRoutes, { prefix: "/api", checkDatabase });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
