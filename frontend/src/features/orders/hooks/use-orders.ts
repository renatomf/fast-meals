import type { CreateOrderInput, Order, OrderList, OrderStatus } from "@fastmeals/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeOrderStatus,
  createOrder,
  fetchAvailableProducts,
  fetchOrder,
  fetchOrderHistory,
  fetchOrders,
  orderKeys,
  type OrderFilters,
} from "../services/orders-api";

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: ({ signal }) => fetchOrders(filters, signal),
    // Trocar de página ou filtro mantém a lista anterior na tela até a nova chegar.
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ""),
    queryFn: ({ signal }) => fetchOrder(id ?? "", signal),
    enabled: id !== undefined,
  });
}

export function useOrderHistory(id: string | undefined) {
  return useQuery({
    queryKey: orderKeys.history(id ?? ""),
    queryFn: ({ signal }) => fetchOrderHistory(id ?? "", signal),
    enabled: id !== undefined,
  });
}

export function useAvailableProducts(enabled: boolean) {
  return useQuery({
    queryKey: ["products", "available-for-orders"],
    queryFn: ({ signal }) => fetchAvailableProducts(signal),
    enabled,
    staleTime: 60_000,
  });
}

type StatusChange = { id: string; status: OrderStatus };
type Snapshot = { detail: Order | undefined; lists: [readonly unknown[], OrderList | undefined][] };

// Atualização otimista: o novo status aparece na hora, na lista e no detalhe. Se a API
// recusar (transição inválida, outro operador mudou antes), volta ao que era e a tela
// mostra o motivo; no fim, recarrega do servidor de qualquer jeito.
export function useChangeOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation<Order, Error, StatusChange, Snapshot>({
    mutationFn: ({ id, status }) => changeOrderStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.all });
      const snapshot: Snapshot = {
        detail: queryClient.getQueryData<Order>(orderKeys.detail(id)),
        lists: queryClient.getQueriesData<OrderList>({ queryKey: orderKeys.lists() }),
      };
      queryClient.setQueryData<Order>(orderKeys.detail(id), (order) =>
        order ? { ...order, status } : order,
      );
      queryClient.setQueriesData<OrderList>({ queryKey: orderKeys.lists() }, (list) =>
        list
          ? {
              ...list,
              data: list.data.map((order) => (order.id === id ? { ...order, status } : order)),
            }
          : list,
      );
      return snapshot;
    },
    onError: (_error, { id }, snapshot) => {
      if (!snapshot) return;
      queryClient.setQueryData(orderKeys.detail(id), snapshot.detail);
      for (const [key, data] of snapshot.lists) queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  });
}
