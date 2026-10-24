import { orderStatuses, type OrderStatus } from "@fastmeals/contracts";
import { describe, expect, it } from "vitest";
import { checkTransition } from "../src/modules/orders/domain/order-state-machine.ts";

// Copiado do enunciado, de propósito sem ler de contracts: se a tabela compartilhada
// mudar por engano, este teste quebra.
const allowedByChallenge = new Set([
  "pending → preparing",
  "pending → cancelled",
  "preparing → ready",
  "preparing → cancelled",
  "ready → delivering",
  "ready → cancelled",
  "delivering → delivered",
]);

const everyPair = orderStatuses.flatMap((from) =>
  orderStatuses.map((to) => ({ from, to, allowed: allowedByChallenge.has(`${from} → ${to}`) })),
);

const withDeliveryPerson = (status: OrderStatus) => ({ status, deliveryPersonId: "dp-1" });

describe("order state machine", () => {
  describe("transição válida", () => {
    it.each(everyPair.filter((pair) => pair.allowed))("accepts $from → $to", ({ from, to }) => {
      expect(checkTransition(withDeliveryPerson(from), to)).toEqual({ ok: true });
    });
  });

  describe("transição inválida", () => {
    it.each(everyPair.filter((pair) => !pair.allowed))("rejects $from → $to", ({ from, to }) => {
      expect(checkTransition(withDeliveryPerson(from), to)).toEqual({
        ok: false,
        reason: "not-allowed",
      });
    });
  });

  it("covers all 36 pairs, 7 of them allowed", () => {
    expect(everyPair).toHaveLength(36);
    expect(everyPair.filter((pair) => pair.allowed)).toHaveLength(7);
  });

  it("requires a delivery person to go from ready to delivering", () => {
    expect(checkTransition({ status: "ready", deliveryPersonId: null }, "delivering")).toEqual({
      ok: false,
      reason: "missing-delivery-person",
    });
  });

  it("does not require a delivery person to cancel a ready order", () => {
    expect(checkTransition({ status: "ready", deliveryPersonId: null }, "cancelled")).toEqual({
      ok: true,
    });
  });
});
