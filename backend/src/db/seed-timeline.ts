import type { OrderStatus, VehicleType } from "@fastmeals/contracts";
import type { Random } from "./random.ts";

export const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
// São Paulo está em UTC-3 o ano todo desde o fim do horário de verão, em 2019.
const SAO_PAULO_UTC_OFFSET_HOURS = 3;

const statusPath: Record<Exclude<OrderStatus, "cancelled">, OrderStatus[]> = {
  pending: ["pending"],
  preparing: ["pending", "preparing"],
  ready: ["pending", "preparing", "ready"],
  delivering: ["pending", "preparing", "ready", "delivering"],
  delivered: ["pending", "preparing", "ready", "delivering", "delivered"],
};

const rideMinutes: Record<VehicleType, readonly [number, number]> = {
  bicycle: [18, 35],
  motorcycle: [8, 20],
  car: [12, 28],
};

export type Transition = {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  minutesAfterCreation: number;
};

type TimelineInput = {
  finalStatus: OrderStatus;
  // O item mais demorado define quando o pedido fica pronto.
  preparationMinutes: number;
  vehicleType: VehicleType | null;
};

// Caminho de status até o final, com durações plausíveis entre os passos. A primeira
// transição (from null → pending) representa a criação do pedido.
export function buildTimeline(random: Random, input: TimelineInput): Transition[] {
  const path =
    input.finalStatus === "cancelled"
      ? random.pick([
          ["pending", "cancelled"],
          ["pending", "preparing", "cancelled"],
        ] satisfies OrderStatus[][])
      : statusPath[input.finalStatus];

  let elapsed = 0;
  return path.map((toStatus, index) => {
    const fromStatus = path[index - 1] ?? null;
    if (fromStatus) elapsed += stepMinutes(random, toStatus, input);
    return { fromStatus, toStatus, minutesAfterCreation: elapsed };
  });
}

function stepMinutes(random: Random, toStatus: OrderStatus, input: TimelineInput): number {
  switch (toStatus) {
    case "pending":
      return 0;
    case "preparing":
      return random.int(1, 6);
    case "ready":
      return Math.round(input.preparationMinutes * (0.9 + random.next() * 0.4));
    case "delivering":
      return random.int(2, 10);
    case "delivered": {
      if (!input.vehicleType) throw new Error("A delivered order needs a delivery person");
      const [min, max] = rideMinutes[input.vehicleType];
      return random.int(min, max);
    }
    case "cancelled":
      return random.int(2, 15);
  }
}

// Folga para a duração de um pedido inteiro (até ~2 h, da criação à entrega).
const LONGEST_ORDER_MS = 3 * 60 * MINUTE_MS;

// Horário de almoço ou jantar em São Paulo, `daysAgo` dias atrás. Com daysAgo = 1, o jantar
// de ontem ainda estaria em andamento logo depois da meia-noite: aí o pedido recua um dia,
// para que o pedido inteiro fique sempre no passado.
export function mealTimeDaysAgo(random: Random, now: Date, daysAgo: number): Date {
  const day = new Date(now.getTime() - daysAgo * DAY_MS);
  const localHour = random.next() < 0.45 ? random.int(11, 14) : random.int(18, 22);
  const createdAt = new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      localHour + SAO_PAULO_UTC_OFFSET_HOURS,
      random.int(0, 59),
    ),
  );
  return createdAt.getTime() + LONGEST_ORDER_MS > now.getTime()
    ? new Date(createdAt.getTime() - DAY_MS)
    : createdAt;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}
