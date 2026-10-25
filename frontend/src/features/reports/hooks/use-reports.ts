import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchDeliveryTime,
  fetchOrdersByStatus,
  fetchRevenue,
  fetchTopProducts,
  reportKeys,
} from "@/services/reports-api";
import type { DateRange } from "@/utils/dates";

export const TOP_PRODUCTS_LIMIT = 10;

// Quatro consultas em paralelo; trocar o período mantém os números anteriores na tela até
// os novos chegarem, em vez de piscar os esqueletos.
export function useReports(range: DateRange) {
  const revenue = useQuery({
    queryKey: reportKeys.revenue(range),
    queryFn: ({ signal }) => fetchRevenue(range, signal),
    placeholderData: keepPreviousData,
  });
  const ordersByStatus = useQuery({
    queryKey: reportKeys.ordersByStatus(range),
    queryFn: ({ signal }) => fetchOrdersByStatus(range, signal),
    placeholderData: keepPreviousData,
  });
  const topProducts = useQuery({
    queryKey: reportKeys.topProducts(range, TOP_PRODUCTS_LIMIT),
    queryFn: ({ signal }) => fetchTopProducts(range, TOP_PRODUCTS_LIMIT, signal),
    placeholderData: keepPreviousData,
  });
  const deliveryTime = useQuery({
    queryKey: reportKeys.deliveryTime(range),
    queryFn: ({ signal }) => fetchDeliveryTime(range, signal),
    placeholderData: keepPreviousData,
  });
  return { revenue, ordersByStatus, topProducts, deliveryTime };
}
