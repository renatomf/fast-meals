import type {
  AverageDeliveryTimeReport,
  OrdersByStatusReport,
  RevenueReport,
  TopProductsReport,
} from "@fastmeals/contracts";
import { apiRequest, toQueryString } from "@/services/api-client";
import type { DateRange } from "@/utils/dates";

// Usado pelo dashboard e pela tela de relatórios: as duas telas compartilham o cache.
export const reportKeys = {
  all: ["reports"] as const,
  revenue: (range: DateRange) => [...reportKeys.all, "revenue", range] as const,
  ordersByStatus: (range: DateRange) => [...reportKeys.all, "orders-by-status", range] as const,
  deliveryTime: (range: DateRange) => [...reportKeys.all, "average-delivery-time", range] as const,
  topProducts: (range: DateRange, limit: number) =>
    [...reportKeys.all, "top-products", range, limit] as const,
};

export function fetchRevenue(range: DateRange, signal?: AbortSignal) {
  return apiRequest<RevenueReport>(`/reports/revenue${toQueryString(range)}`, { signal });
}

export function fetchOrdersByStatus(range: DateRange, signal?: AbortSignal) {
  return apiRequest<OrdersByStatusReport>(`/reports/orders-by-status${toQueryString(range)}`, {
    signal,
  });
}

export function fetchDeliveryTime(range: DateRange, signal?: AbortSignal) {
  return apiRequest<AverageDeliveryTimeReport>(
    `/reports/average-delivery-time${toQueryString(range)}`,
    { signal },
  );
}

export function fetchTopProducts(range: DateRange, limit: number, signal?: AbortSignal) {
  return apiRequest<TopProductsReport>(
    `/reports/top-products${toQueryString({ ...range, limit })}`,
    { signal },
  );
}
