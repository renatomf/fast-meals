import type { ListDeliveryPersonsQuery } from "@fastmeals/contracts";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Executor } from "../../db/client.ts";
import { deliveryPersons, orders } from "../../models/index.ts";

export type DeliveryPersonValues = Partial<typeof deliveryPersons.$inferInsert>;

// O pedido que ocupa o entregador. O índice único parcial garante que há no máximo um.
// Nomes qualificados à mão: numa consulta de uma tabela só, o Drizzle escreve as colunas
// sem o nome da tabela, e a correlação virava "delivery_person_id = id" dentro de orders.
const currentOrderId = sql<string | null>`(
  select active.id from orders as active
  where active.delivery_person_id = "delivery_persons"."id"
    and active.status in ('ready', 'delivering')
)`;

const columns = {
  id: deliveryPersons.id,
  name: deliveryPersons.name,
  phone: deliveryPersons.phone,
  vehicleType: deliveryPersons.vehicleType,
  isActive: deliveryPersons.isActive,
  currentLatitude: deliveryPersons.currentLatitude,
  currentLongitude: deliveryPersons.currentLongitude,
  currentOrderId,
  createdAt: deliveryPersons.createdAt,
  updatedAt: deliveryPersons.updatedAt,
};

async function list(db: Executor, query: ListDeliveryPersonsQuery) {
  const busy = inArray(
    deliveryPersons.id,
    db
      .select({ id: orders.deliveryPersonId })
      .from(orders)
      .where(
        and(isNotNull(orders.deliveryPersonId), inArray(orders.status, ["ready", "delivering"])),
      ),
  );
  return db
    .select(columns)
    .from(deliveryPersons)
    .where(
      and(
        isNull(deliveryPersons.deletedAt),
        query.isActive === undefined ? undefined : eq(deliveryPersons.isActive, query.isActive),
        query.available === undefined ? undefined : query.available ? sql`not ${busy}` : busy,
      ),
    )
    .orderBy(asc(deliveryPersons.name), asc(deliveryPersons.id));
}

async function findById(db: Executor, id: string) {
  const [row] = await db
    .select(columns)
    .from(deliveryPersons)
    .where(and(eq(deliveryPersons.id, id), isNull(deliveryPersons.deletedAt)));
  return row;
}

async function insert(db: Executor, values: typeof deliveryPersons.$inferInsert) {
  const [row] = await db
    .insert(deliveryPersons)
    .values(values)
    .returning({ id: deliveryPersons.id });
  if (!row) throw new Error("INSERT ... RETURNING returned no row");
  return row.id;
}

async function update(db: Executor, id: string, values: DeliveryPersonValues) {
  const [row] = await db
    .update(deliveryPersons)
    .set(values)
    .where(and(eq(deliveryPersons.id, id), isNull(deliveryPersons.deletedAt)))
    .returning({ id: deliveryPersons.id });
  return row?.id;
}

// Mesmo padrão dos produtos: o UPDATE trava a linha, e uma atribuição simultânea (que lê o
// entregador com FOR SHARE) espera esta transação terminar.
async function softDelete(db: Executor, id: string) {
  const [row] = await db
    .update(deliveryPersons)
    .set({ deletedAt: new Date() })
    .where(and(eq(deliveryPersons.id, id), isNull(deliveryPersons.deletedAt)))
    .returning({ id: deliveryPersons.id });
  return row?.id;
}

async function hasActiveOrder(db: Executor, id: string): Promise<boolean> {
  const [match] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.deliveryPersonId, id), inArray(orders.status, ["ready", "delivering"])))
    .limit(1);
  return match !== undefined;
}

export const deliveryPersonsRepository = {
  list,
  findById,
  insert,
  update,
  softDelete,
  hasActiveOrder,
};

export type DeliveryPersonsRepository = typeof deliveryPersonsRepository;
