import { z } from "zod";
import { orderStatusSchema } from "./domain.ts";

// O que o trigger notify_change publica (migration 0006): só identificadores. Quem recebe
// busca os dados pela API, com as permissões de sempre.
export const changeEventSchema = z.object({
  entity: z.enum(["orders", "products", "delivery_persons"]),
  op: z.enum(["insert", "update", "delete"]),
  id: z.uuid(),
  status: orderStatusSchema.nullable(),
});
export type ChangeEvent = z.infer<typeof changeEventSchema>;

// O token vai na primeira mensagem, e não na URL: query string acaba em logs de proxy.
// A mesma mensagem renova a autenticação quando o access token é trocado.
export const realtimeClientMessageSchema = z.object({
  type: z.literal("auth"),
  token: z.string().min(1).max(4096),
});
export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;

export type RealtimeServerMessage = { type: "ready" } | { type: "change"; event: ChangeEvent };

// Códigos de fechamento da aplicação (4000–4999 são livres pela RFC 6455).
export const REALTIME_CLOSE = {
  unauthorized: 4401,
  tokenExpired: 4001,
  forbiddenOrigin: 4403,
} as const;
