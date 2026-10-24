import {
  NO_AVAILABLE_DELIVERY_PERSON,
  OPTIMIZATION_BATCH_LIMIT,
  WAITING_NEXT_BATCH,
} from "@fastmeals/contracts";
import { describe, expect, it } from "vitest";
import type { Database } from "../src/db/client.ts";
import type { DispatchRepository } from "../src/modules/dispatch/dispatch.repository.ts";
import { createDispatchService } from "../src/modules/dispatch/dispatch.service.ts";

// Sem banco: o repositório falso entrega o volume que seria caro de montar com inserts.
function serviceWith(orderCount: number, peopleCount: number) {
  const orders = Array.from({ length: orderCount }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    deliveryAddress: `Pedido ${index}`,
    latitude: -23.55 + index * 0.0001,
    longitude: -46.63,
  }));
  const people = Array.from({ length: peopleCount }, (_, index) => ({
    id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name: `Entregador ${index}`,
    latitude: -23.55,
    longitude: -46.63 + index * 0.0001,
  }));
  const repository = {
    ordersAwaitingDeliveryPerson: async () => orders,
    assignableDeliveryPersons: async () => people,
  };
  const service = createDispatchService({
    db: {} as Database,
    repository: repository as unknown as DispatchRepository,
  });
  return { service, orders };
}

describe("dispatch service: batch limit", () => {
  it(`optimizes only the ${OPTIMIZATION_BATCH_LIMIT} oldest ready orders and defers the rest`, async () => {
    const { service, orders } = serviceWith(OPTIMIZATION_BATCH_LIMIT + 2, 3);

    const { response } = await service.optimize();

    expect(response.assignments).toHaveLength(3);
    const deferred = response.unassigned.filter((item) => item.reason === WAITING_NEXT_BATCH);
    // O repositório entrega do mais antigo para o mais novo: os dois últimos esperam.
    expect(deferred.map((item) => item.orderId)).toEqual(orders.slice(-2).map((order) => order.id));
    expect(
      response.unassigned.filter((item) => item.reason === NO_AVAILABLE_DELIVERY_PERSON),
    ).toHaveLength(OPTIMIZATION_BATCH_LIMIT - 3);
    // Os adiados não entram na conta: a matriz tem só o lote.
    const assignedIds = new Set(response.assignments.map((item) => item.orderId));
    expect(orders.slice(-2).some((order) => assignedIds.has(order.id))).toBe(false);
  });

  it("keeps the matrix at the batch size, so one call cannot stall the API", async () => {
    const { service } = serviceWith(5_000, 500);

    const { response } = await service.optimize({ includeMatrix: true });

    expect(response.costMatrix?.orderIds).toHaveLength(OPTIMIZATION_BATCH_LIMIT);
    // O limite do enunciado; o pior caso estruturado leva ~250 ms numa máquina comum.
    expect(response.executionTimeMs).toBeLessThan(2_000);
  });
});
