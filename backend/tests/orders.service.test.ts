import type { OrderStatus } from "@fastmeals/contracts";
import { describe, expect, it } from "vitest";
import type { Database } from "../src/db/client.ts";
import type { OrdersRepository } from "../src/modules/orders/orders.repository.ts";
import { createOrdersService } from "../src/modules/orders/orders.service.ts";

// Sem banco: o repositório entra pela factory (app.ts monta o real), então o service pode
// ser exercitado com um falso que só registra o que foi pedido a ele. Os testes de
// integração cobrem o SQL; aqui o foco é a decisão do service.
function serviceWith(
  state: { status: OrderStatus; deliveryPersonId: string | null },
  options = { updateWins: true },
) {
  const writes: string[] = [];
  const repository = {
    findState: async () => state,
    updateStatus: async (_db: unknown, _id: string, from: OrderStatus, to: OrderStatus) => {
      writes.push(`update ${from} → ${to}`);
      return options.updateWins;
    },
    recordTransition: async (
      _db: unknown,
      values: { fromStatus: OrderStatus | null; toStatus: OrderStatus },
    ) => {
      writes.push(`history ${values.fromStatus} → ${values.toStatus}`);
    },
    findById: async (_db: unknown, id: string) => ({ id, status: state.status }),
    itemsOf: async () => [],
  };
  // A transação falsa só executa o callback: atomicidade é assunto dos testes com banco.
  const db = { transaction: (work: (tx: unknown) => Promise<unknown>) => work({}) };
  const service = createOrdersService({
    db: db as unknown as Database,
    repository: repository as unknown as OrdersRepository,
  });
  return { service, writes };
}

describe("orders service (repository fake)", () => {
  it("writes the new status and its history entry for an allowed transition", async () => {
    const { service, writes } = serviceWith({ status: "pending", deliveryPersonId: null });

    await service.changeStatus("order-1", "preparing", "user-1");

    expect(writes).toEqual(["update pending → preparing", "history pending → preparing"]);
  });

  it("refuses a transition outside the table without writing anything", async () => {
    const { service, writes } = serviceWith({ status: "delivered", deliveryPersonId: "dp-1" });

    await expect(service.changeStatus("order-1", "pending", "user-1")).rejects.toMatchObject({
      statusCode: 422,
      code: "INVALID_STATUS_TRANSITION",
    });
    expect(writes).toEqual([]);
  });

  it("answers 409 and skips the history when another request changed the order first", async () => {
    const { service, writes } = serviceWith(
      { status: "pending", deliveryPersonId: null },
      { updateWins: false },
    );

    await expect(service.changeStatus("order-1", "preparing", "user-1")).rejects.toMatchObject({
      statusCode: 409,
      code: "ORDER_CONFLICT",
    });
    expect(writes).toEqual(["update pending → preparing"]);
  });
});
