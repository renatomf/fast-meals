import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptAssignment,
  createDemoScenario,
  dispatchKeys,
  fetchAvailableCouriers,
  fetchReadyOrders,
  optimizeAssignment,
} from "../services/dispatch-api";

export function useReadyOrders() {
  return useQuery({
    queryKey: dispatchKeys.readyOrders,
    queryFn: ({ signal }) => fetchReadyOrders(signal),
  });
}

export function useAvailableCouriers() {
  return useQuery({
    queryKey: dispatchKeys.availableCouriers,
    queryFn: ({ signal }) => fetchAvailableCouriers(signal),
  });
}

// A matriz completa só vem quando cabe numa tela: 50 × 50 já são 2.500 células. Acima
// disso o heatmap não ajudaria a ler nada, e a resposta cresceria à toa.
export const MATRIX_CELL_LIMIT = 2_500;

export function useOptimizeAssignment() {
  return useMutation({
    mutationFn: (includeMatrix: boolean) => optimizeAssignment(includeMatrix),
  });
}

export function useAcceptAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, deliveryPersonId }: { orderId: string; deliveryPersonId: string }) =>
      acceptAssignment(orderId, deliveryPersonId),
    // Pedido e entregador mudam de estado: listas, dashboard e despacho recarregam juntos.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["delivery-persons"] }),
      ]),
  });
}

export function useDemoScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDemoScenario,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["delivery-persons"] }),
      ]),
  });
}
