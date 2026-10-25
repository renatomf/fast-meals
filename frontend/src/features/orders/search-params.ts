import { isoDateSchema, orderStatusSchema } from "@fastmeals/contracts";
import { z } from "zod";

// Filtros, página e pedido aberto vivem na URL: o link é compartilhável e o "voltar" do
// navegador funciona. Valor inválido digitado na URL vira "sem filtro" (.catch), não erro.
export const ordersSearchSchema = z.object({
  page: z.number().int().min(1).optional().catch(undefined),
  status: orderStatusSchema.optional().catch(undefined),
  startDate: isoDateSchema.optional().catch(undefined),
  endDate: isoDateSchema.optional().catch(undefined),
  order: z.uuid().optional().catch(undefined),
});

export type OrdersSearch = z.infer<typeof ordersSearchSchema>;
