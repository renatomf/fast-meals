import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
} from "@fastmeals/contracts";
import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../utils/app-error.ts";
import type { AuthService, Session } from "./auth.service.ts";

export const REFRESH_COOKIE = "refresh_token";

// Sem corpo, o Fastify entrega body null.
type TokenRequest = FastifyRequest<{ Body: RefreshRequest | null | undefined }>;

// httpOnly: JavaScript não lê o token, então um XSS não o rouba.
// SameSite=Strict + Path=/api/auth: o navegador só o envia nas rotas de auth e só em
// requisições originadas no próprio site, o que fecha o CSRF (ADR 0004).
// Secure: localhost conta como contexto seguro nos navegadores, então funciona em dev.
const refreshCookie: CookieSerializeOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/api/auth",
};

export function createAuthController(authService: AuthService) {
  function respondWithSession(reply: FastifyReply, session: Session): LoginResponse {
    reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      ...refreshCookie,
      expires: session.refreshTokenExpiresAt,
    });
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    };
  }

  // O token do corpo tem precedência: é o contrato do api-spec. O front não o envia
  // e cai no cookie.
  function presentedRefreshToken(request: TokenRequest) {
    return request.body?.refreshToken ?? request.cookies[REFRESH_COOKIE];
  }

  return {
    async login(
      request: FastifyRequest<{ Body: LoginRequest }>,
      reply: FastifyReply,
    ): Promise<LoginResponse> {
      const { email, password } = request.body;
      let session: Session;
      try {
        session = await authService.login(email, password);
      } catch (error) {
        // Trilha de auditoria: sem isso, uma força bruta passaria despercebida nos logs.
        if (error instanceof AppError && error.code === "INVALID_CREDENTIALS") {
          request.log.warn({ email, ip: request.ip }, "login failed");
        }
        throw error;
      }
      request.log.info({ userId: session.user.id, ip: request.ip }, "login succeeded");
      return respondWithSession(reply, session);
    },

    async refresh(request: TokenRequest, reply: FastifyReply): Promise<RefreshResponse> {
      const session = await authService.refresh(presentedRefreshToken(request));
      return respondWithSession(reply, session);
    },

    async logout(request: TokenRequest, reply: FastifyReply): Promise<void> {
      await authService.logout(presentedRefreshToken(request));
      reply.clearCookie(REFRESH_COOKIE, refreshCookie);
      await reply.status(204).send();
    },

    async me(request: FastifyRequest): Promise<AuthUser> {
      if (!request.user) throw new Error("GET /auth/me must run after authenticate");
      return authService.currentUser(request.user.id);
    },
  };
}
