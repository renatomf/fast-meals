import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  orderStatusSchema,
  productCategorySchema,
  userRoleSchema,
  vehicleTypeSchema,
} from "@fastmeals/contracts";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { deliveryPersons, products, users } from "../models/index.ts";
import { centsToDecimal, toCents } from "../utils/money.ts";
import type { Database, Executor } from "./client.ts";
import { SETUP_LOCK_ID } from "./migrate.ts";
import { createRandom } from "./random.ts";
import { insertOrders, prepareOrder, type SeedDeliveryPerson } from "./seed-orders.ts";
import { addMinutes } from "./seed-timeline.ts";

// O enunciado pede no mínimo 10; 12 custa ~250 ms por hash, imperceptível no login.
export const BCRYPT_ROUNDS = 12;
const SEED = 20_260_123;

const seedFile = new URL("../../../seed/data.json", import.meta.url);

const seedDataSchema = z.object({
  users: z.array(z.object({ email: z.email(), password: z.string(), role: userRoleSchema })),
  products: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      price: z.number().positive(),
      category: productCategorySchema,
      imageUrl: z.url().nullable(),
      isAvailable: z.boolean(),
      preparationTime: z.number().int(),
    }),
  ),
  deliveryPersons: z.array(
    z.object({
      name: z.string(),
      phone: z.string(),
      vehicleType: vehicleTypeSchema,
      isActive: z.boolean(),
      currentLatitude: z.number().nullable(),
      currentLongitude: z.number().nullable(),
    }),
  ),
  orders: z.array(
    z.object({
      customerName: z.string(),
      customerPhone: z.string(),
      deliveryAddress: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      status: orderStatusSchema,
      deliveryPersonIndex: z.number().int().optional(),
      items: z.array(z.object({ productIndex: z.number().int(), quantity: z.number().int() })),
    }),
  ),
});

export type SeedSummary =
  | { seeded: false }
  | { seeded: true; users: number; products: number; deliveryPersons: number; orders: number };

async function readSeedData() {
  return seedDataSchema.parse(JSON.parse(await readFile(seedFile, "utf8")));
}

function byIndex<T>(list: readonly T[], index: number, what: string): T {
  const item = list[index];
  if (item === undefined) throw new Error(`seed/data.json references missing ${what} #${index}`);
  return item;
}

// Banco já populado não é tocado: o container roda o seed a cada start e não pode
// apagar o que foi feito pela interface. `reset` recria tudo do zero.
export async function seedOfficialData(
  db: Database,
  { now = new Date(), reset = false } = {},
): Promise<SeedSummary> {
  const data = await readSeedData();
  const passwordHashes = await Promise.all(
    data.users.map((user) => bcrypt.hash(user.password, BCRYPT_ROUNDS)),
  );

  return db.transaction(async (tx) => {
    // Mesmo lock das migrations: dois seeds simultâneos não duplicam os dados.
    await tx.execute(sql`select pg_advisory_xact_lock(${SETUP_LOCK_ID})`);

    if (reset) {
      await tx.execute(
        sql`truncate users, products, delivery_persons, orders, order_items, order_status_history, refresh_tokens`,
      );
    } else if (await hasUsers(tx)) {
      return { seeded: false };
    }

    const random = createRandom(SEED);
    // Cadastros "existem" desde antes do primeiro pedido; um minuto entre cada um
    // mantém estável a ordenação padrão por createdAt.
    const catalogCreatedAt = addMinutes(now, -60 * 24 * 60);

    const insertedUsers = await tx
      .insert(users)
      .values(
        data.users.map((user, index) => ({
          email: user.email,
          password: byIndex(passwordHashes, index, "password hash"),
          role: user.role,
        })),
      )
      .returning({ id: users.id, role: users.role });
    const admin = insertedUsers.find((user) => user.role === "admin");
    if (!admin) throw new Error("seed/data.json has no admin user");

    const seededProducts = data.products.map((product, index) => ({
      id: randomUUID(),
      ...product,
      price: centsToDecimal(toCents(product.price)),
      createdAt: addMinutes(catalogCreatedAt, index),
      updatedAt: addMinutes(catalogCreatedAt, index),
    }));
    await tx.insert(products).values(seededProducts);

    const seededDeliveryPersons = data.deliveryPersons.map((person, index) => ({
      id: randomUUID(),
      ...person,
      createdAt: addMinutes(catalogCreatedAt, index),
      updatedAt: addMinutes(catalogCreatedAt, index),
    }));
    await tx.insert(deliveryPersons).values(seededDeliveryPersons);

    const preparedOrders = data.orders.map(({ items, deliveryPersonIndex, ...order }) => {
      const deliveryPerson: SeedDeliveryPerson | null =
        deliveryPersonIndex === undefined
          ? null
          : byIndex(seededDeliveryPersons, deliveryPersonIndex, "delivery person");
      return prepareOrder(
        random,
        {
          ...order,
          deliveryPerson,
          items: items.map((item) => ({
            product: byIndex(seededProducts, item.productIndex, "product"),
            quantity: item.quantity,
          })),
        },
        { now, daysAgo: random.int(2, 30), changedBy: admin.id },
      );
    });
    await insertOrders(tx, preparedOrders);

    return {
      seeded: true,
      users: insertedUsers.length,
      products: seededProducts.length,
      deliveryPersons: seededDeliveryPersons.length,
      orders: preparedOrders.length,
    };
  });
}

async function hasUsers(db: Executor): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length > 0;
}
