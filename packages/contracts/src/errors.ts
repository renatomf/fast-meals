import { z } from "zod";

export const errorCodes = [
  "VALIDATION_ERROR",
  "INVALID_CREDENTIALS",
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "INVALID_REFRESH_TOKEN",
  "FORBIDDEN",
  "NOT_FOUND",
  "PRODUCT_NOT_FOUND",
  "ORDER_NOT_FOUND",
  "DELIVERY_PERSON_NOT_FOUND",
  "PRODUCT_IN_USE",
  "DELIVERY_PERSON_IN_USE",
  "ORDER_CONFLICT",
  "ORDER_NOT_ASSIGNABLE",
  "INVALID_STATUS_TRANSITION",
  "UNAVAILABLE_PRODUCT",
  "DELIVERY_PERSON_UNAVAILABLE",
  "RATE_LIMIT_EXCEEDED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(errorCodes),
    message: z.string(),
    // O formato de details varia: { field, message } em validação,
    // { productId, productName, reason } em UNAVAILABLE_PRODUCT.
    details: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
