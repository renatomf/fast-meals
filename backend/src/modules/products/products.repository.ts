import type { ListProductsQuery } from "@fastmeals/contracts";
import { and, asc, count, desc, eq, ilike, inArray, isNull, type SQL } from "drizzle-orm";
import type { Executor } from "../../db/client.ts";
import { orderItems, orders, products } from "../../models/index.ts";
import { pageOffset } from "../../utils/pagination.ts";

export type ProductRow = typeof products.$inferSelect;
export type ProductValues = Partial<typeof products.$inferInsert>;

const sortColumns = {
  name: products.name,
  price: products.price,
  createdAt: products.createdAt,
} as const;

// % e _ são curingas do LIKE: sem escapar, buscar "50%" acharia tudo que tem "50".
function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function listFilters(query: ListProductsQuery): SQL | undefined {
  return and(
    isNull(products.deletedAt),
    query.search ? ilike(products.name, containsPattern(query.search)) : undefined,
    query.category ? eq(products.category, query.category) : undefined,
    query.isAvailable === undefined ? undefined : eq(products.isAvailable, query.isAvailable),
  );
}

async function list(db: Executor, query: ListProductsQuery) {
  const where = listFilters(query);
  const direction = query.sortOrder === "asc" ? asc : desc;
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      // id desempata: sem ele, a mesma linha pode aparecer em duas páginas.
      .orderBy(direction(sortColumns[query.sortBy]), direction(products.id))
      .limit(query.limit)
      .offset(pageOffset(query)),
    db.select({ total: count() }).from(products).where(where),
  ]);
  return { rows, total: totals?.total ?? 0 };
}

async function findById(db: Executor, id: string) {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)));
  return row;
}

async function insert(db: Executor, values: typeof products.$inferInsert) {
  const [row] = await db.insert(products).values(values).returning();
  if (!row) throw new Error("INSERT ... RETURNING returned no row");
  return row;
}

async function update(db: Executor, id: string, values: ProductValues) {
  const [row] = await db
    .update(products)
    .set(values)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .returning();
  return row;
}

// O UPDATE trava a linha até o fim da transação. Uma criação de pedido que tente usar
// o produto ao mesmo tempo espera e depois o enxerga como excluído.
async function softDelete(db: Executor, id: string) {
  const [row] = await db
    .update(products)
    .set({ deletedAt: new Date() })
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .returning({ id: products.id });
  return row;
}

async function isInOpenOrders(db: Executor, productId: string): Promise<boolean> {
  const [match] = await db
    .select({ orderId: orders.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(eq(orderItems.productId, productId), inArray(orders.status, ["pending", "preparing"])),
    )
    .limit(1);
  return match !== undefined;
}

export const productsRepository = {
  list,
  findById,
  insert,
  update,
  softDelete,
  isInOpenOrders,
};

export type ProductsRepository = typeof productsRepository;
