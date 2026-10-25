import type { CreateDeliveryPersonInput, UpdateDeliveryPersonInput } from "@fastmeals/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDeliveryPerson,
  deleteDeliveryPerson,
  deliveryPersonKeys,
  fetchDeliveryPersons,
  updateDeliveryPerson,
  type DeliveryPersonFilters,
} from "../services/delivery-persons-api";

export function useDeliveryPersons(filters: DeliveryPersonFilters) {
  return useQuery({
    queryKey: deliveryPersonKeys.list(filters),
    queryFn: ({ signal }) => fetchDeliveryPersons(filters, signal),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: deliveryPersonKeys.all });
}

export function useCreateDeliveryPerson() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateDeliveryPersonInput) => createDeliveryPerson(input),
    onSuccess: invalidate,
  });
}

export function useUpdateDeliveryPerson() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDeliveryPersonInput }) =>
      updateDeliveryPerson(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteDeliveryPerson() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteDeliveryPerson(id),
    onSuccess: invalidate,
  });
}
