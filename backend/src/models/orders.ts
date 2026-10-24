import { orderStatuses, type OrderStatus } from "@fastmeals/contracts";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, oneOf, updatedAt } from "./columns.ts";
import { deliveryPersons } from "./delivery-persons.ts";
import { products } from "./products.ts";
import { users } from "./users.ts";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerName: varchar("customer_name", { length: 100 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    deliveryAddress: varchar("delivery_address", { length: 300 }).notNull(),
    latitude: numeric("latitude", { precision: 10, scale: 8, mode: "number" }).notNull(),
    longitude: numeric("longitude", { precision: 11, scale: 8, mode: "number" }).notNull(),
    status: varchar("status", { length: 20 }).$type<OrderStatus>().notNull().default("pending"),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    deliveryPersonId: uuid("delivery_person_id").references(() => deliveryPersons.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("orders_status_check", oneOf(t.status, orderStatuses)),
    check("orders_total_amount_check", sql`${t.totalAmount} > 0`),
    check(
      "orders_coordinates_check",
      sql`${t.latitude} between -90 and 90 and ${t.longitude} between -180 and 180`,
    ),
    index("idx_orders_status").on(t.status),
    index("idx_orders_created_at").on(t.createdAt.desc()),
    index("idx_orders_delivery_person_id").on(t.deliveryPersonId),
    index("idx_orders_status_created").on(t.status, t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    // Snapshot do preço no momento do pedido; mudar o produto depois não altera o pedido.
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("order_items_quantity_check", sql`${t.quantity} > 0`),
    check("order_items_unit_price_check", sql`${t.unitPrice} > 0`),
    index("idx_order_items_order_id").on(t.orderId),
    index("idx_order_items_product_id").on(t.productId),
  ],
);

// Uma linha por mudança de status. Alimenta o tempo médio de entrega (instante da
// transição para delivered) e a linha do tempo do pedido. from_status nulo = criação.
export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: varchar("from_status", { length: 20 }).$type<OrderStatus>(),
    toStatus: varchar("to_status", { length: 20 }).$type<OrderStatus>().notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("order_status_history_from_status_check", oneOf(t.fromStatus, orderStatuses)),
    check("order_status_history_to_status_check", oneOf(t.toStatus, orderStatuses)),
    index("idx_order_status_history_order").on(t.orderId, t.changedAt),
    index("idx_order_status_history_to_status").on(t.toStatus, t.changedAt),
  ],
);
