import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
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
import { createLoginThrottle } from "./modules/auth/login-throttle.ts";
import { deliveryPersonsRepository } from "./modules/delivery-persons/delivery-persons.repository.ts";
import { deliveryPersonsRoutes } from "./modules/delivery-persons/delivery-persons.routes.ts";
import { createDeliveryPersonsService } from "./modules/delivery-persons/delivery-persons.service.ts";
import { dispatchRepository } from "./modules/dispatch/dispatch.repository.ts";
import { dispatchRoutes } from "./modules/dispatch/dispatch.routes.ts";
import { createDispatchService } from "./modules/dispatch/dispatch.service.ts";
import { healthRoutes } from "./modules/health/health.routes.ts";
import { ordersRepository } from "./modules/orders/orders.repository.ts";
import { ordersRoutes } from "./modules/orders/orders.routes.ts";
import { createOrdersService } from "./modules/orders/orders.service.ts";
import { productsRepository } from "./modules/products/products.repository.ts";
import { productsRoutes } from "./modules/products/products.routes.ts";
import { createProductsService } from "./modules/products/products.service.ts";
import { AppError } from "./utils/app-error.ts";

type LogStream = { write: (line: string) => void };

export type AppDependencies = {
  env: Env;
  db: Database;
  checkDatabase: () => Promise<boolean>;
  // Só nos testes: recebe as linhas de log para verificar os eventos de segurança.
  logStream?: LogStream;
};

function loggerOptions(env: Env, logStream?: LogStream): FastifyServerOptions["logger"] {
  if (env.NODE_ENV === "test") return logStream ? { level: "info", stream: logStream } : false;
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
export async function buildApp({ env, db, checkDatabase, logStream }: AppDependencies) {
  const app = Fastify({
    logger: loggerOptions(env, logStream),
    requestIdHeader: "x-request-id",
    // Um cliente lento, ou mal-intencionado, não segura sockets indefinidamente: a requisição
    // inteira tem 30 s e uma conexão parada é fechada em 10 s.
    requestTimeout: 30_000,
    connectionTimeout: 10_000,
    // hop 0 é o endereço do socket; confiar em N saltos = aceitar o X-Forwarded-For
    // escrito pelos N proxies mais próximos e nada antes deles.
    trustProxy: (_address: string, hop: number) => hop < env.TRUST_PROXY_HOPS,
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
  // Store em memória: o limite vale por instância. Com várias réplicas, o store passa
  // a ser o Redis (ADR 0006).
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) =>
      new AppError(
        429,
        "RATE_LIMIT_EXCEEDED",
        `Limite de requisições atingido. Tente novamente em ${Math.ceil(context.ttl / 1000)} s.`,
      ),
  });
  // Sem o preHandler, URLs inexistentes escapariam do limite.
  app.setNotFoundHandler({ preHandler: app.rateLimit() }, notFoundHandler);

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
    // 10 falhas em 15 min bloqueiam o email pelo resto da janela (ADR 0004).
    loginThrottle: createLoginThrottle({ maxFailures: 10, windowMs: 15 * 60_000 }),
    securityLog: app.log,
  });
  const authenticate = createAuthenticate(authService.verifyAccessToken);

  const productsService = createProductsService({ db, repository: productsRepository });
  const deliveryPersonsService = createDeliveryPersonsService({
    db,
    repository: deliveryPersonsRepository,
  });
  const ordersService = createOrdersService({ db, repository: ordersRepository });
  const dispatchService = createDispatchService({ db, repository: dispatchRepository });

  await app.register(healthRoutes, { prefix: "/api", checkDatabase });
  await app.register(authRoutes, { prefix: "/api/auth", authService, authenticate });

  // Área autenticada: o hook vale para toda rota registrada aqui dentro, então uma rota
  // nova não tem como esquecer a autenticação. O perfil é conferido rota a rota (authorize).
  await app.register(
    async (api) => {
      api.addHook("onRequest", authenticate);
      await api.register(productsRoutes, { productsService });
      await api.register(ordersRoutes, { ordersService });
      await api.register(dispatchRoutes, { dispatchService });
      await api.register(deliveryPersonsRoutes, { deliveryPersonsService });
    },
    { prefix: "/api" },
  );

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
