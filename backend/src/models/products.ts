import { productCategories, type ProductCategory } from "@fastmeals/contracts";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, oneOf, updatedAt } from "./columns.ts";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    // numeric chega como string: o valor exato é convertido para centavos no domínio.
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    category: varchar("category", { length: 20 }).$type<ProductCategory>().notNull(),
    imageUrl: varchar("image_url", { length: 500 }),
    isAvailable: boolean("is_available").notNull().default(true),
    preparationTime: integer("preparation_time").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // Soft delete: order_items referencia o produto sem ON DELETE, e pedidos antigos
    // continuam precisando do nome dele (premissa 5 do DECISIONS.md).
    deletedAt: deletedAt(),
  },
  (t) => [
    check("products_price_check", sql`${t.price} > 0`),
    check("products_category_check", oneOf(t.category, productCategories)),
    check("products_preparation_time_check", sql`${t.preparationTime} between 1 and 120`),
    index("idx_products_category").on(t.category),
    index("idx_products_is_available").on(t.isAvailable),
    index("idx_products_name").on(t.name),
    // Ascendente de propósito: lido de trás para frente, atende o ORDER BY created_at DESC,
    // id DESC da listagem. O .desc() do Drizzle gera DESC NULLS LAST, que não bate com o
    // DESC padrão (NULLS FIRST), e o planejador ignorava o índice e lia a tabela inteira.
    index("idx_products_created_at").on(t.createdAt, t.id),
    // A busca é ILIKE '%termo%', que um B-tree não atende; trigramas sim.
    index("idx_products_name_trgm").using("gin", t.name.op("gin_trgm_ops")),
  ],
);
