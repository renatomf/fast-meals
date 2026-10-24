import { vehicleTypes, type VehicleType } from "@fastmeals/contracts";
import { sql } from "drizzle-orm";
import { boolean, check, index, numeric, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, deletedAt, oneOf, updatedAt } from "./columns.ts";

export const deliveryPersons = pgTable(
  "delivery_persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    vehicleType: varchar("vehicle_type", { length: 20 }).$type<VehicleType>().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    currentLatitude: numeric("current_latitude", { precision: 10, scale: 8, mode: "number" }),
    currentLongitude: numeric("current_longitude", { precision: 11, scale: 8, mode: "number" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // Mesmo motivo dos produtos: orders.delivery_person_id não tem ON DELETE e o
    // histórico de entregas precisa do entregador (tempo médio por veículo).
    deletedAt: deletedAt(),
  },
  (t) => [
    check("delivery_persons_vehicle_type_check", oneOf(t.vehicleType, vehicleTypes)),
    check(
      "delivery_persons_coordinates_check",
      sql`(${t.currentLatitude} is null) = (${t.currentLongitude} is null)
        and ${t.currentLatitude} between -90 and 90
        and ${t.currentLongitude} between -180 and 180`,
    ),
    index("idx_delivery_persons_is_active").on(t.isActive),
  ],
);
