import {
  NO_AVAILABLE_DELIVERY_PERSON,
  OPTIMIZATION_BATCH_LIMIT,
  WAITING_NEXT_BATCH,
  type OptimizeAssignmentResponse,
} from "@fastmeals/contracts";
import { greedy } from "../../algorithms/greedy.ts";
import { haversineKm } from "../../algorithms/haversine.ts";
import { hungarian } from "../../algorithms/hungarian.ts";
import type { Database } from "../../db/client.ts";
import type { DispatchRepository } from "./dispatch.repository.ts";

type DispatchServiceOptions = {
  db: Database;
  repository: DispatchRepository;
};

export type Optimization = {
  response: OptimizeAssignmentResponse;
  timings: { hungarianMs: number; greedyMs: number };
};

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function createDispatchService({ db, repository }: DispatchServiceOptions) {
  async function optimize({ includeMatrix = false } = {}): Promise<Optimization> {
    const [awaiting, people] = await Promise.all([
      repository.ordersAwaitingDeliveryPerson(db),
      repository.assignableDeliveryPersons(db),
    ]);
    // O repositório devolve do mais antigo para o mais novo: quem espera há mais tempo entra.
    const orders = awaiting.slice(0, OPTIMIZATION_BATCH_LIMIT);
    const deferred = awaiting.slice(OPTIMIZATION_BATCH_LIMIT);

    // executionTimeMs cobre o que é do algoritmo: montar a matriz e resolvê-la. As
    // consultas ao banco ficam de fora, para o número não variar com a rede.
    const startedAt = performance.now();
    const distancesKm = orders.map((order) => people.map((person) => haversineKm(order, person)));
    const optimal = hungarian(distancesKm);
    const hungarianMs = performance.now() - startedAt;

    const greedyStartedAt = performance.now();
    const baseline = greedy(distancesKm);
    const greedyMs = performance.now() - greedyStartedAt;

    const assignments: OptimizeAssignmentResponse["assignments"] = [];
    const unassigned: OptimizeAssignmentResponse["unassigned"] = [];
    orders.forEach((order, row) => {
      const column = optimal.rowToColumn[row] ?? null;
      const person = column === null ? undefined : people[column];
      if (column === null || !person) {
        unassigned.push({
          orderId: order.id,
          orderAddress: order.deliveryAddress,
          reason: NO_AVAILABLE_DELIVERY_PERSON,
        });
        return;
      }
      assignments.push({
        orderId: order.id,
        deliveryPersonId: person.id,
        estimatedDistanceKm: roundTo(distancesKm[row]?.[column] ?? 0, 2),
        orderAddress: order.deliveryAddress,
        deliveryPersonName: person.name,
      });
    });

    for (const order of deferred) {
      unassigned.push({
        orderId: order.id,
        orderAddress: order.deliveryAddress,
        reason: WAITING_NEXT_BATCH,
      });
    }

    return {
      response: {
        assignments,
        unassigned,
        totalDistanceKm: roundTo(optimal.totalCost, 2),
        algorithm: "hungarian",
        executionTimeMs: roundTo(hungarianMs, 2),
        baseline: { algorithm: "greedy", totalDistanceKm: roundTo(baseline.totalCost, 2) },
        ...(includeMatrix && {
          costMatrix: {
            orderIds: orders.map((order) => order.id),
            deliveryPersonIds: people.map((person) => person.id),
            distancesKm: distancesKm.map((row) => row.map((distance) => roundTo(distance, 3))),
          },
        }),
      },
      timings: { hungarianMs, greedyMs },
    };
  }

  return { optimize };
}

export type DispatchService = ReturnType<typeof createDispatchService>;
