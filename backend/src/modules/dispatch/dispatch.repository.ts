import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Executor } from "../../db/client.ts";
import { deliveryPersons, orders } from "../../models/index.ts";

// Só leitura: a otimização sugere, quem grava é a atribuição (PATCH /orders/:id/assign).
// A ordem é estável (criação, depois id) para que a mesma situação gere a mesma sugestão.

async function ordersAwaitingDeliveryPerson(db: Executor) {
  return db
    .select({
      id: orders.id,
      deliveryAddress: orders.deliveryAddress,
      latitude: orders.latitude,
      longitude: orders.longitude,
    })
    .from(orders)
    .where(and(eq(orders.status, "ready"), isNull(orders.deliveryPersonId)))
    .orderBy(asc(orders.createdAt), asc(orders.id));
}

// Ativos, sem pedido ready ou delivering e com localização: sem coordenadas não há
// distância para calcular.
async function assignableDeliveryPersons(db: Executor) {
  const busy = db
    .select({ id: orders.deliveryPersonId })
    .from(orders)
    .where(
      and(isNotNull(orders.deliveryPersonId), inArray(orders.status, ["ready", "delivering"])),
    );
  const rows = await db
    .select({
      id: deliveryPersons.id,
      name: deliveryPersons.name,
      latitude: deliveryPersons.currentLatitude,
      longitude: deliveryPersons.currentLongitude,
    })
    .from(deliveryPersons)
    .where(
      and(
        isNull(deliveryPersons.deletedAt),
        eq(deliveryPersons.isActive, true),
        isNotNull(deliveryPersons.currentLatitude),
        isNotNull(deliveryPersons.currentLongitude),
        sql`not ${inArray(deliveryPersons.id, busy)}`,
      ),
    )
    .orderBy(asc(deliveryPersons.createdAt), asc(deliveryPersons.id));
  return rows.flatMap(({ latitude, longitude, ...person }) =>
    latitude === null || longitude === null ? [] : [{ ...person, latitude, longitude }],
  );
}

export const dispatchRepository = { ordersAwaitingDeliveryPerson, assignableDeliveryPersons };

export type DispatchRepository = typeof dispatchRepository;
