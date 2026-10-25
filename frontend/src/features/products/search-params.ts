import { productCategories, productSortFields } from "@fastmeals/contracts";
import { z } from "zod";

// Busca, filtros, ordenação e página ficam na URL. Valor inválido vira o padrão.
export const productsSearchSchema = z.object({
  page: z.number().int().min(1).optional().catch(undefined),
  search: z.string().trim().max(120).optional().catch(undefined),
  category: z.enum(productCategories).optional().catch(undefined),
  availability: z.enum(["available", "unavailable"]).optional().catch(undefined),
  sortBy: z.enum(productSortFields).optional().catch(undefined),
  sortOrder: z.enum(["asc", "desc"]).optional().catch(undefined),
});
export type ProductsSearch = z.infer<typeof productsSearchSchema>;
