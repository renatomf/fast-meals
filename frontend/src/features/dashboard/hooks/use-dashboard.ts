import { useQuery } from "@tanstack/react-query";
import { lastDays } from "@/utils/dates";
import {
  fetchDeliveryTime,
  fetchOrdersByStatus,
  fetchRevenue,
  reportKeys,
} from "../services/dashboard-api";

// Período atual e o imediatamente anterior, do mesmo tamanho: a variação dos indicadores
// compara janelas iguais.
export function useDashboard(days: number) {
  const { current, previous } = lastDays(days);

  const revenue = useQuery({
    queryKey: reportKeys.revenue(current),
    queryFn: ({ signal }) => fetchRevenue(current, signal),
  });
  const previousRevenue = useQuery({
    queryKey: reportKeys.revenue(previous),
    queryFn: ({ signal }) => fetchRevenue(previous, signal),
  });
  const ordersByStatus = useQuery({
    queryKey: reportKeys.ordersByStatus(current),
    queryFn: ({ signal }) => fetchOrdersByStatus(current, signal),
  });
  const deliveryTime = useQuery({
    queryKey: reportKeys.deliveryTime(current),
    queryFn: ({ signal }) => fetchDeliveryTime(current, signal),
  });
  const previousDeliveryTime = useQuery({
    queryKey: reportKeys.deliveryTime(previous),
    queryFn: ({ signal }) => fetchDeliveryTime(previous, signal),
  });

  return {
    range: current,
    revenue,
    previousRevenue,
    ordersByStatus,
    deliveryTime,
    previousDeliveryTime,
  };
}
