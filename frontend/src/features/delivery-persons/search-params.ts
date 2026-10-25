import { z } from "zod";

export const deliveryPersonFilters = ["active", "inactive", "available"] as const;

export const deliveryPersonsSearchSchema = z.object({
  filter: z.enum(deliveryPersonFilters).optional().catch(undefined),
});
export type DeliveryPersonsSearch = z.infer<typeof deliveryPersonsSearchSchema>;
