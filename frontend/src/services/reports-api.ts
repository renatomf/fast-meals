import type {
  AverageDeliveryTimeReport,
  OrdersByStatusReport,
  RevenueReport,
} from "@fastmeals/contracts";
import { apiRequest, toQueryString } from "@/services/api-client";
import type { DateRange } from "@/utils/dates";

export const reportKeys = {
  all: ["reports"] as const,
  revenue: (range: DateRange) => [...reportKeys.all, "revenue", range] as const,
  ordersByStatus: (range: DateRange) => [...reportKeys.all, "orders-by-status", range] as const,
  deliveryTime: (range: DateRange) => [...reportKeys.all, "average-delivery-time", range] as const,
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
