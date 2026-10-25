import type {
  CreateOrderInput,
  Order,
  OrderHistory,
  OrderList,
  OrderStatus,
  ProductList,
} from "@fastmeals/contracts";
import { apiRequest, toQueryString } from "@/services/api-client";

export type OrderFilters = {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  sortOrder?: "asc" | "desc";
};

// Chaves de cache numa fábrica: invalidar "tudo de pedidos" ou "só este pedido" fica
// preciso, sem strings soltas. O tempo real (dia 6) invalida pelas mesmas chaves.
export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (filters: OrderFilters) => [...orderKeys.lists(), filters] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
  history: (id: string) => [...orderKeys.all, "history", id] as const,
};

export function fetchOrders(filters: OrderFilters, signal?: AbortSignal) {
  return apiRequest<OrderList>(`/orders${toQueryString(filters)}`, { signal });
}

export function fetchOrder(id: string, signal?: AbortSignal) {
  return apiRequest<Order>(`/orders/${id}`, { signal });
}

export function fetchOrderHistory(id: string, signal?: AbortSignal) {
  return apiRequest<OrderHistory>(`/orders/${id}/history`, { signal });
}

export function changeOrderStatus(id: string, status: OrderStatus) {
  return apiRequest<Order>(`/orders/${id}/status`, { method: "PATCH", body: { status } });
}

export function createOrder(input: CreateOrderInput) {
  return apiRequest<Order>("/orders", { method: "POST", body: input });
}

// Só os disponíveis entram num pedido novo (premissa 2 do DECISIONS.md).
export function fetchAvailableProducts(signal?: AbortSignal) {
  return apiRequest<ProductList>("/products?isAvailable=true&limit=100&sortBy=name&sortOrder=asc", {
    signal,
  });
}
