import { z } from "zod";
import { moneySchema, queryBooleanSchema, timestampSchema } from "./common.ts";
import { productCategories, productCategorySchema } from "./domain.ts";
import { paginatedSchema, paginationQuerySchema, sortOrderSchema } from "./pagination.ts";

const nameMessage = "O nome deve ter entre 3 e 120 caracteres";
const descriptionMessage = "A descrição deve ter entre 10 e 500 caracteres";
const preparationMessage = "O tempo de preparo deve ser entre 1 e 120 minutos";

// Sem defaults aqui: no PUT parcial, um default preencheria campos que o cliente não
// enviou (isAvailable voltaria a true a cada edição de preço).
const productFields = {
  name: z.string().trim().min(3, nameMessage).max(120, nameMessage),
  description: z.string().trim().min(10, descriptionMessage).max(500, descriptionMessage),
  price: moneySchema.positive("O preço deve ser maior que zero"),
  category: z.enum(productCategories, `A categoria deve ser ${productCategories.join(", ")}`),
  imageUrl: z
    .url({ protocol: /^https?$/, error: "A imagem deve ser uma URL http(s) válida" })
    .max(500, "A URL da imagem deve ter até 500 caracteres")
    .nullable(),
  isAvailable: z.boolean("Disponibilidade deve ser true ou false"),
  preparationTime: z
    .number("O tempo de preparo deve ser um número")
    .int("O tempo de preparo deve ser um número inteiro de minutos")
    .min(1, preparationMessage)
    .max(120, preparationMessage),
};

export const createProductSchema = z.object({
  ...productFields,
  imageUrl: productFields.imageUrl.default(null),
  isAvailable: productFields.isAvailable.default(true),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object(productFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "Envie ao menos um campo para atualizar");
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productSortFields = ["name", "price", "createdAt"] as const;

export const listProductsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  category: productCategorySchema.optional(),
  isAvailable: queryBooleanSchema.optional(),
  sortBy: z.enum(productSortFields).default("createdAt"),
  sortOrder: sortOrderSchema,
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const productSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  category: productCategorySchema,
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  preparationTime: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Product = z.infer<typeof productSchema>;

export const productListSchema = paginatedSchema(productSchema);
export type ProductList = z.infer<typeof productListSchema>;
