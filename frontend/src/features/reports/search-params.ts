import { isoDateSchema } from "@fastmeals/contracts";
import { z } from "zod";

// O período fica na URL: o link do relatório abre exatamente o mesmo recorte.
export const reportsSearchSchema = z.object({
  startDate: isoDateSchema.optional().catch(undefined),
  endDate: isoDateSchema.optional().catch(undefined),
});
export type ReportsSearch = z.infer<typeof reportsSearchSchema>;
