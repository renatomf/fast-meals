import { count, eq } from "drizzle-orm";
import { loadEnv } from "../config/env.ts";
import { deliveryPersons, orders, products, users } from "../models/index.ts";
import { createDatabase } from "./client.ts";
import { migrateDatabase } from "./migrate.ts";
import { createPool } from "./pool.ts";
import { createRandom } from "./random.ts";
import { seedOfficialData } from "./seed-official.ts";
import { insertOrders, prepareOrder } from "./seed-orders.ts";

// npm run seed:load — volume para os benchmarks de listagem e relatórios (spec 9).
// Todos os pedidos gerados estão encerrados (delivered/cancelled): não ocupam
// entregadores nem aparecem na fila de despacho.
const LOAD_ORDER_COUNT = 10_000;
const HISTORY_DAYS = 90;
const SEED = 20_260_124;

const firstNames = [
  "Ana",
  "Bruno",
  "Carla",
  "Daniel",
  "Elisa",
  "Felipe",
  "Gabriela",
  "Hugo",
  "Isabela",
  "João",
  "Karina",
  "Lucas",
  "Marina",
  "Nicolas",
  "Olivia",
  "Paulo",
  "Renata",
  "Samuel",
  "Tatiana",
  "Vitor",
];
const lastNames = [
  "Almeida",
  "Barbosa",
  "Cardoso",
  "Dias",
  "Ferreira",
  "Gomes",
  "Lima",
  "Martins",
  "Nunes",
  "Oliveira",
  "Pereira",
  "Ribeiro",
  "Santos",
  "Souza",
  "Teixeira",
];
const streets = [
  "Rua Augusta",
  "Av. Paulista",
  "Rua Oscar Freire",
  "Rua da Consolação",
  "Av. Rebouças",
  "Rua Vergueiro",
  "Rua Pamplona",
  "Rua Haddock Lobo",
  "Av. Brigadeiro Luís Antônio",
  "Rua Frei Caneca",
  "Rua Teodoro Sampaio",
  "Av. Faria Lima",
];

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
const db = createDatabase(pool);

try {
  await migrateDatabase(pool);
  await seedOfficialData(db);

  const [existing] = await db.select({ total: count() }).from(orders);
  if ((existing?.total ?? 0) >= LOAD_ORDER_COUNT) {
    console.log(`Database already has ${existing?.total} orders; nothing to do.`);
  } else {
    const inserted = await generateLoad();
    console.log(`Inserted ${inserted} orders spread over the last ${HISTORY_DAYS} days.`);
  }
} finally {
  await pool.end();
}

async function generateLoad(): Promise<number> {
  const random = createRandom(SEED);
  const now = new Date();

  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  if (!admin) throw new Error("No admin user; run npm run seed first");
  const menu = await db
    .select({ id: products.id, price: products.price, preparationTime: products.preparationTime })
    .from(products)
    .where(eq(products.isAvailable, true));
  const fleet = await db
    .select({ id: deliveryPersons.id, vehicleType: deliveryPersons.vehicleType })
    .from(deliveryPersons)
    .where(eq(deliveryPersons.isActive, true));

  const prepared = Array.from({ length: LOAD_ORDER_COUNT }, () => {
    const status = random.next() < 0.9 ? "delivered" : "cancelled";
    return prepareOrder(
      random,
      {
        customerName: `${random.pick(firstNames)} ${random.pick(lastNames)}`,
        customerPhone: `(11) 9${random.int(1000, 9999)}-${random.int(1000, 9999)}`,
        deliveryAddress: `${random.pick(streets)}, ${random.int(10, 3000)}, São Paulo - SP`,
        // Região central de São Paulo, ~10 km em cada direção.
        latitude: Number((-23.56 + (random.next() - 0.5) * 0.18).toFixed(6)),
        longitude: Number((-46.65 + (random.next() - 0.5) * 0.18).toFixed(6)),
        status,
        items: Array.from({ length: random.int(1, 4) }, () => ({
          product: random.pick(menu),
          quantity: random.int(1, 3),
        })),
        deliveryPerson: status === "delivered" ? random.pick(fleet) : null,
      },
      { now, daysAgo: random.int(2, HISTORY_DAYS), changedBy: admin.id },
    );
  });

  await db.transaction((tx) => insertOrders(tx, prepared));
  return prepared.length;
}
