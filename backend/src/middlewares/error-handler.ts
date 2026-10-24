import type { ErrorResponse } from "@fastmeals/contracts";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { AppError } from "../utils/app-error.ts";

function send(reply: FastifyReply, statusCode: number, body: ErrorResponse) {
  return reply.status(statusCode).send(body);
}

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    const details = error.validation.map((issue) => ({
      // instancePath vem como "/items/0/quantity"; sem path, o problema é no objeto inteiro.
      field: issue.instancePath.replace(/^\//, "").replaceAll("/", ".") || error.validationContext,
      message: issue.message ?? "Valor inválido",
    }));
    return send(reply, 400, {
      error: { code: "VALIDATION_ERROR", message: "Dados inválidos", details },
    });
  }

  if (error instanceof AppError) {
    return send(reply, error.statusCode, {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    });
  }

  // Erros 4xx do próprio Fastify: JSON malformado, content-type não suportado, body grande demais.
  if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
    return send(reply, error.statusCode, {
      error: { code: "VALIDATION_ERROR", message: error.message },
    });
  }

  request.log.error({ err: error }, "unhandled error");
  return send(reply, 500, {
    error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
  });
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return send(reply, 404, {
    error: { code: "NOT_FOUND", message: `Rota ${request.method} ${request.url} não encontrada` },
  });
}
