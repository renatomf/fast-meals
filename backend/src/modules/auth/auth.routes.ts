import {
  authUserSchema,
  errorResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
} from "@fastmeals/contracts";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { createAuthController } from "./auth.controller.ts";
import type { AuthService } from "./auth.service.ts";

type AuthRoutesOptions = {
  authService: AuthService;
  authenticate: (request: FastifyRequest) => Promise<void>;
};

// Mais apertado que o limite global de 100/min: o login é o alvo de força bruta.
const LOGIN_RATE_LIMIT = { max: 10, timeWindow: "1 minute" };

export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (
  app,
  { authService, authenticate },
) => {
  const controller = createAuthController(authService);

  app.post(
    "/login",
    {
      config: { rateLimit: LOGIN_RATE_LIMIT },
      schema: {
        tags: ["auth"],
        summary: "Autentica com email e senha",
        description:
          "Devolve o access token (15 min) e o refresh token (7 dias). O refresh token também " +
          "é gravado num cookie httpOnly restrito a /api/auth.",
        body: loginRequestSchema,
        response: {
          200: loginResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    (request, reply) => controller.login(request, reply),
  );

  app.post(
    "/refresh",
    {
      schema: {
        tags: ["auth"],
        summary: "Troca o refresh token por um novo par de tokens",
        description:
          "Aceita o refresh token no corpo ou no cookie. Cada token vale uma vez: a resposta " +
          "traz um novo, e reapresentar um token já usado encerra todas as sessões daquele login.",
        body: refreshRequestSchema.nullish(),
        response: {
          200: refreshResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    (request, reply) => controller.refresh(request, reply),
  );

  app.post(
    "/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "Encerra a sessão",
        description: "Revoga o refresh token (corpo ou cookie) e todos os da mesma sessão.",
        body: refreshRequestSchema.nullish(),
      },
    },
    (request, reply) => controller.logout(request, reply),
  );

  app.get(
    "/me",
    {
      onRequest: authenticate,
      schema: {
        tags: ["auth"],
        summary: "Usuário dono do access token",
        security: [{ bearerAuth: [] }],
        response: { 200: authUserSchema, 401: errorResponseSchema },
      },
    },
    (request) => controller.me(request),
  );
};
