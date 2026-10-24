import type { ListOrdersQuery, OrderStatus } from "@fastmeals/contracts";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import type { Executor } from "../../db/client.ts";
import {
  deliveryPersons,
  orderItems,
  orders,
  orderStatusHistory,
  products,
  users,
} from "../../models/index.ts";
import { pageOffset } from "../../utils/pagination.ts";

const orderColumns = {
  id: orders.id,
  customerName: orders.customerName,
  customerPhone: orders.customerPhone,
  deliveryAddress: orders.deliveryAddress,
  latitude: orders.latitude,
  longitude: orders.longitude,
  status: orders.status,
  totalAmount: orders.totalAmount,
  createdAt: orders.createdAt,
  updatedAt: orders.updatedAt,
  deliveryPerson: {
    id: deliveryPersons.id,
    name: deliveryPersons.name,
    phone: deliveryPersons.phone,
    vehicleType: deliveryPersons.vehicleType,
  },
};

const sortColumns = { createdAt: orders.createdAt, totalAmount: orders.totalAmount } as const;

// Os dias do filtro são dias de São Paulo: "2026-10-20" vai de 00:00 a 23:59:59 locais.
function startOfDay(date: string): SQL {
  return sql`(${date}::date)::timestamp at time zone 'America/Sao_Paulo'`;
}

function listFilters(query: ListOrdersQuery): SQL | undefined {
  return and(
    query.status ? eq(orders.status, query.status) : undefined,
    query.startDate ? gte(orders.createdAt, startOfDay(query.startDate)) : undefined,
    query.endDate
      ? lt(
          orders.createdAt,
          sql`((${query.endDate}::date + 1)::timestamp at time zone 'America/Sao_Paulo')`,
        )
      : undefined,
  );
}

async function list(db: Executor, query: ListOrdersQuery) {
  const where = listFilters(query);
  const direction = query.sortOrder === "asc" ? asc : desc;
  const [rows, [totals]] = await Promise.all([
    db
      .select(orderColumns)
      .from(orders)
      .leftJoin(deliveryPersons, eq(deliveryPersons.id, orders.deliveryPersonId))
      .where(where)
      .orderBy(direction(sortColumns[query.sortBy]), asc(orders.id))
      .limit(query.limit)
      .offset(pageOffset(query)),
    db.select({ total: count() }).from(orders).where(where),
  ]);
  return { rows, total: totals?.total ?? 0 };
}

async function findById(db: Executor, id: string) {
  const [row] = await db
    .select(orderColumns)
    .from(orders)
    .leftJoin(deliveryPersons, eq(deliveryPersons.id, orders.deliveryPersonId))
    .where(eq(orders.id, id));
  return row;
}

// Uma consulta para os itens de todos os pedidos da página, em vez de uma por pedido.
// Produtos excluídos entram: o pedido antigo continua mostrando o nome do que foi vendido.
async function itemsOf(db: Executor, orderIds: string[]) {
  if (orderIds.length === 0) return [];
  return db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      product: { id: products.id, name: products.name },
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(inArray(orderItems.orderId, orderIds))
    .orderBy(asc(orderItems.createdAt), asc(orderItems.id));
}

async function historyOf(db: Executor, orderId: string) {
  return db
    .select({
      id: orderStatusHistory.id,
      fromStatus: orderStatusHistory.fromStatus,
      toStatus: orderStatusHistory.toStatus,
      changedAt: orderStatusHistory.changedAt,
      changedBy: { id: users.id, email: users.email },
    })
    .from(orderStatusHistory)
    .leftJoin(users, eq(users.id, orderStatusHistory.changedBy))
    .where(eq(orderStatusHistory.orderId, orderId))
    .orderBy(asc(orderStatusHistory.changedAt), asc(orderStatusHistory.id));
}

async function findState(db: Executor, id: string) {
  const [row] = await db
    .select({ status: orders.status, deliveryPersonId: orders.deliveryPersonId })
    .from(orders)
    .where(eq(orders.id, id));
  return row;
}

// FOR SHARE: enquanto o pedido é criado, ninguém exclui nem altera estes produtos. Uma
// exclusão simultânea espera, e uma que veio antes faz o produto sumir daqui.
async function lockProductsForOrder(db: Executor, productIds: string[]) {
  return db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      isAvailable: products.isAvailable,
    })
    .from(products)
    .where(and(inArray(products.id, productIds), isNull(products.deletedAt)))
    .for("share");
}

async function insertOrder(db: Executor, values: typeof orders.$inferInsert) {
  const [row] = await db.insert(orders).values(values).returning({ id: orders.id });
  if (!row) throw new Error("INSERT ... RETURNING returned no row");
  return row.id;
}

async function insertItems(db: Executor, values: (typeof orderItems.$inferInsert)[]) {
  await db.insert(orderItems).values(values);
}

async function recordTransition(db: Executor, values: typeof orderStatusHistory.$inferInsert) {
  await db.insert(orderStatusHistory).values(values);
}

// WHERE status = from: se outra requisição mudou o pedido entre a leitura e esta escrita,
// nenhuma linha é afetada e quem chamou sabe que perdeu a corrida.
async function updateStatus(db: Executor, id: string, from: OrderStatus, to: OrderStatus) {
  const [row] = await db
    .update(orders)
    .set({ status: to })
    .where(and(eq(orders.id, id), eq(orders.status, from)))
    .returning({ id: orders.id });
  return row !== undefined;
}

// FOR SHARE pelo mesmo motivo dos produtos: uma exclusão ou desativação simultânea do
// entregador espera esta atribuição terminar, e vice-versa.
async function lockDeliveryPerson(db: Executor, id: string) {
  const [row] = await db
    .select({ id: deliveryPersons.id, isActive: deliveryPersons.isActive })
    .from(deliveryPersons)
    .where(and(eq(deliveryPersons.id, id), isNull(deliveryPersons.deletedAt)))
    .for("share");
  return row;
}

async function assignDeliveryPerson(db: Executor, id: string, deliveryPersonId: string) {
  const [row] = await db
    .update(orders)
    .set({ deliveryPersonId })
    .where(and(eq(orders.id, id), eq(orders.status, "ready")))
    .returning({ id: orders.id });
  return row !== undefined;
}

export const ordersRepository = {
  list,
  findById,
  itemsOf,
  historyOf,
  findState,
  lockProductsForOrder,
  insertOrder,
  insertItems,
  recordTransition,
  updateStatus,
  lockDeliveryPerson,
  assignDeliveryPerson,
};

export type OrdersRepository = typeof ordersRepository;
