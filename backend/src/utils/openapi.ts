import { errorResponseSchema } from "@fastmeals/contracts";

// Peças repetidas nos schemas das rotas protegidas: o cadeado no Swagger e os erros que
// qualquer leitura ou escrita pode devolver.
export const bearerSecurity = [{ bearerAuth: [] }];

export const readErrorResponses = { 400: errorResponseSchema, 401: errorResponseSchema };

export const writeErrorResponses = { ...readErrorResponses, 403: errorResponseSchema };
