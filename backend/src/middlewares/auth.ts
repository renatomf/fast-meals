import type { UserRole } from "@fastmeals/contracts";
import type { FastifyRequest } from "fastify";
import type { RequestUser } from "../modules/auth/auth.service.ts";
import { AppError } from "../utils/app-error.ts";

declare module "fastify" {
  interface FastifyRequest {
    user: RequestUser | null;
  }
}

const BEARER = /^Bearer (\S+)$/i;

// Recebe a verificação pronta do auth.service para que a regra (segredo, claims,
// expirado × inválido) fique num lugar só.
export function createAuthenticate(verifyAccessToken: (token: string) => RequestUser) {
  return async function authenticate(request: FastifyRequest) {
    const token = BEARER.exec(request.headers.authorization ?? "")?.[1];
    if (!token) {
      throw new AppError(401, "INVALID_TOKEN", "Envie o token de acesso no header Authorization");
    }
    request.user = verifyAccessToken(token);
  };
}

// Roda depois do authenticate: sem usuário aqui é rota montada fora da área protegida.
export function authorize(...roles: UserRole[]) {
  return async function checkRole(request: FastifyRequest) {
    if (!request.user) {
      throw new AppError(401, "INVALID_TOKEN", "Envie o token de acesso no header Authorization");
    }
    if (!roles.includes(request.user.role)) {
      throw new AppError(403, "FORBIDDEN", "Você não tem permissão para esta ação");
    }
  };
}
