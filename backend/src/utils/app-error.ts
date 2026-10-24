import type { ErrorCode } from "@fastmeals/contracts";

export type ErrorDetail = Record<string, unknown>;

// Erro esperado do domínio. O error handler converte para o formato padrão da API;
// qualquer outra exceção vira 500.
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: ErrorDetail[] | undefined;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
