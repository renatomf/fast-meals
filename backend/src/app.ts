import cookie from "@fastify/cookie";
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
import type { Database } from "./db/client.ts";
import { createAuthenticate } from "./middlewares/auth.ts";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.ts";
import { authRepository } from "./modules/auth/auth.repository.ts";
import { authRoutes } from "./modules/auth/auth.routes.ts";
import { createAuthService } from "./modules/auth/auth.service.ts";
import { healthRoutes } from "./modules/health/health.routes.ts";

export type AppDependencies = {
  env: Env;
  db: Database;
  checkDatabase: () => Promise<boolean>;
};

function loggerOptions(env: Env): FastifyServerOptions["logger"] {
  if (env.NODE_ENV === "test") return false;
  return {
    level: env.LOG_LEVEL,
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "req.body.password",
      "req.body.refreshToken",
    ],
    ...(env.NODE_ENV === "development" && {
      transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } },
    }),
  };
}

// Composition root: todas as dependências entram por aqui, o que permite
// montar a aplicação nos testes com fakes no lugar do banco.
export async function buildApp({ env, db, checkDatabase }: AppDependencies) {
  const app = Fastify({
    logger: loggerOptions(env),
    requestIdHeader: "x-request-id",
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.decorateRequest("user", null);

  // CSP é uma política de documento; a API só devolve JSON. O front recebe CSP do nginx
  // e o Swagger UI declara a própria via staticCSP.
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(cookie);
  app.setNotFoundHandler(notFoundHandler);

  await app.register(swagger, {
    openapi: {
      info: {
        title: "FastMeals API",
        description: "API de gestão de pedidos, cardápio, entregadores e despacho.",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/api/docs", staticCSP: true });

  const authService = createAuthService({
    db,
    repository: authRepository,
    accessToken: { secret: env.JWT_SECRET, ttlMs: env.JWT_EXPIRES_IN },
    refreshToken: { secret: env.JWT_REFRESH_SECRET, ttlMs: env.JWT_REFRESH_EXPIRES_IN },
    securityLog: app.log,
  });
  const authenticate = createAuthenticate(authService.verifyAccessToken);

  await app.register(healthRoutes, { prefix: "/api", checkDatabase });
  await app.register(authRoutes, { prefix: "/api/auth", authService, authenticate });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
