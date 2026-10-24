import { randomUUID } from "node:crypto";
import type { OrderStatus, VehicleType } from "@fastmeals/contracts";
import { orderItems, orders, orderStatusHistory } from "../models/index.ts";
import { centsToDecimal, toCents } from "../utils/money.ts";
import type { Executor } from "./client.ts";
import type { Random } from "./random.ts";
import { addMinutes, buildTimeline, mealTimeDaysAgo } from "./seed-timeline.ts";

export type SeedProduct = { id: string; price: string; preparationTime: number };
export type SeedDeliveryPerson = { id: string; vehicleType: VehicleType };

export type OrderDraft = {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  latitude: number;
  longitude: number;
  status: OrderStatus;
  items: { product: SeedProduct; quantity: number }[];
  deliveryPerson: SeedDeliveryPerson | null;
};

type PreparedOrder = {
  order: typeof orders.$inferInsert;
  items: (typeof orderItems.$inferInsert)[];
  history: (typeof orderStatusHistory.$inferInsert)[];
};

const terminalStatuses: readonly OrderStatus[] = ["delivered", "cancelled"];

type Placement = {
  now: Date;
  // Só vale para pedidos encerrados. Pedidos em aberto terminam a linha do tempo
  // poucos minutos antes de "now", como numa operação acontecendo agora.
  daysAgo: number;
  changedBy: string;
};

export function prepareOrder(
  random: Random,
  draft: OrderDraft,
  { now, daysAgo, changedBy }: Placement,
): PreparedOrder {
  const timeline = buildTimeline(random, {
    finalStatus: draft.status,
    preparationMinutes: Math.max(...draft.items.map((item) => item.product.preparationTime)),
    vehicleType: draft.deliveryPerson?.vehicleType ?? null,
  });
  const minutesToLastStatus = timeline.at(-1)?.minutesAfterCreation ?? 0;

  const createdAt = terminalStatuses.includes(draft.status)
    ? mealTimeDaysAgo(random, now, daysAgo)
    : addMinutes(now, -(minutesToLastStatus + random.int(2, 12)));

  const id = randomUUID();
  const totalCents = draft.items.reduce(
    (sum, item) => sum + toCents(item.product.price) * item.quantity,
    0,
  );

  return {
    order: {
      id,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      deliveryAddress: draft.deliveryAddress,
      latitude: draft.latitude,
      longitude: draft.longitude,
      status: draft.status,
      totalAmount: centsToDecimal(totalCents),
      deliveryPersonId: draft.deliveryPerson?.id ?? null,
      createdAt,
      updatedAt: addMinutes(createdAt, minutesToLastStatus),
    },
    items: draft.items.map((item) => ({
      orderId: id,
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.product.price,
      createdAt,
    })),
    history: timeline.map((step) => ({
      orderId: id,
      fromStatus: step.fromStatus,
      toStatus: step.toStatus,
      changedBy,
      changedAt: addMinutes(createdAt, step.minutesAfterCreation),
    })),
  };
}

// O PostgreSQL aceita até 65.535 parâmetros por comando; 1.000 linhas de 11 colunas
// ficam bem abaixo disso.
const CHUNK_SIZE = 1_000;

export async function insertOrders(db: Executor, prepared: PreparedOrder[]): Promise<void> {
  for (let start = 0; start < prepared.length; start += CHUNK_SIZE) {
    const chunk = prepared.slice(start, start + CHUNK_SIZE);
    await db.insert(orders).values(chunk.map((entry) => entry.order));
    await db.insert(orderItems).values(chunk.flatMap((entry) => entry.items));
    await db.insert(orderStatusHistory).values(chunk.flatMap((entry) => entry.history));
  }
}
