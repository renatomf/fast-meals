import type {
  DeliveryPersonList,
  Order,
  OptimizeAssignmentResponse,
  OrderList,
} from "@fastmeals/contracts";
import { apiRequest, toQueryString } from "@/services/api-client";

// Mesmos prefixos das outras telas: invalidar ["orders"] ou ["delivery-persons"] atualiza
// pedidos, dashboard e despacho de uma vez.
export const dispatchKeys = {
  readyOrders: ["orders", "list", { status: "ready", dispatch: true }] as const,
  availableCouriers: ["delivery-persons", "list", { isActive: true, available: true }] as const,
};

// Pedidos prontos mais antigos primeiro: é a mesma ordem em que o backend monta o lote.
export function fetchReadyOrders(signal?: AbortSignal) {
  return apiRequest<OrderList>(
    `/orders${toQueryString({ status: "ready", limit: 100, sortOrder: "asc" })}`,
    { signal },
  );
}

export function fetchAvailableCouriers(signal?: AbortSignal) {
  return apiRequest<DeliveryPersonList>(
    `/delivery-persons${toQueryString({ isActive: true, available: true })}`,
    { signal },
  );
}

export function optimizeAssignment(includeMatrix: boolean) {
  return apiRequest<OptimizeAssignmentResponse>(
    `/orders/optimize-assignment${toQueryString({ includeMatrix: includeMatrix || undefined })}`,
    { method: "POST", body: {} },
  );
}

// Aceitar uma sugestão são dois passos da API: atribuir o entregador e sair para entrega.
// Se o segundo falhar, o pedido fica pronto com o entregador atribuído, e aceitar de novo
// repete os dois passos sem efeito colateral.
export async function acceptAssignment(orderId: string, deliveryPersonId: string) {
  await apiRequest<Order>(`/orders/${orderId}/assign`, {
    method: "PATCH",
    body: { deliveryPersonId },
  });
  return apiRequest<Order>(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status: "delivering" },
  });
}

export function createDemoScenario() {
  return apiRequest<{ orders: number; deliveryPersons: number }>("/dispatch/demo-scenario", {
    method: "POST",
    body: {},
  });
}
