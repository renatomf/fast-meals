import { z } from "zod";
import { queryBooleanSchema } from "./common.ts";

export const NO_AVAILABLE_DELIVERY_PERSON = "No available delivery person";

// O algoritmo roda no processo da API e a bloqueia enquanto calcula: 500 pedidos × 500
// entregadores levam ~30 ms, 2.000 × 2.000 levariam ~700 ms. Acima do limite, os pedidos mais
// antigos entram e os demais esperam a próxima otimização (docs/benchmarks.md).
export const OPTIMIZATION_BATCH_LIMIT = 500;
export const WAITING_NEXT_BATCH = "Waiting for the next optimization batch";

export const optimizeAssignmentQuerySchema = z.object({
  // Matriz de distâncias completa, para a visualização no painel de despacho.
  includeMatrix: queryBooleanSchema.optional(),
});
export type OptimizeAssignmentQuery = z.infer<typeof optimizeAssignmentQuerySchema>;

export const optimizeAssignmentResponseSchema = z.object({
  assignments: z.array(
    z.object({
      orderId: z.uuid(),
      deliveryPersonId: z.uuid(),
      estimatedDistanceKm: z.number(),
      orderAddress: z.string(),
      deliveryPersonName: z.string(),
    }),
  ),
  unassigned: z.array(
    z.object({ orderId: z.uuid(), orderAddress: z.string(), reason: z.string() }),
  ),
  totalDistanceKm: z.number(),
  algorithm: z.literal("hungarian"),
  executionTimeMs: z.number(),
  // Extensões do spec: o total do guloso para comparação e, sob pedido, a matriz.
  baseline: z.object({ algorithm: z.literal("greedy"), totalDistanceKm: z.number() }),
  costMatrix: z
    .object({
      orderIds: z.array(z.uuid()),
      deliveryPersonIds: z.array(z.uuid()),
      distancesKm: z.array(z.array(z.number())),
    })
    .optional(),
});
export type OptimizeAssignmentResponse = z.infer<typeof optimizeAssignmentResponseSchema>;
