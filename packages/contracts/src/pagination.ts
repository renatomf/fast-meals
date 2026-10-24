import { z } from "zod";

export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "A página começa em 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "O limite mínimo é 1 item por página")
    .max(MAX_PAGE_SIZE, `O limite máximo é ${MAX_PAGE_SIZE} itens por página`)
    .default(20),
});

export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

export const paginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type Pagination = z.infer<typeof paginationSchema>;

export function paginatedSchema<Item extends z.ZodType>(item: Item) {
  return z.object({ data: z.array(item), pagination: paginationSchema });
}
