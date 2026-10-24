import { canTransition, type OrderStatus } from "@fastmeals/contracts";

export type TransitionCheck =
  { ok: true } | { ok: false; reason: "not-allowed" | "missing-delivery-person" };

type OrderState = { status: OrderStatus; deliveryPersonId: string | null };

// Falhar faz parte do fluxo normal aqui, por isso o resultado é um valor e não uma
// exceção: quem chama decide como traduzir cada motivo (HTTP 422, botão desabilitado...).
export function checkTransition(order: OrderState, to: OrderStatus): TransitionCheck {
  if (!canTransition(order.status, to)) return { ok: false, reason: "not-allowed" };
  if (to === "delivering" && order.deliveryPersonId === null) {
    return { ok: false, reason: "missing-delivery-person" };
  }
  return { ok: true };
}
