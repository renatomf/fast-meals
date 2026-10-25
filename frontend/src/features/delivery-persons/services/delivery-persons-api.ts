import type {
  CreateDeliveryPersonInput,
  DeliveryPerson,
  DeliveryPersonList,
  UpdateDeliveryPersonInput,
} from "@fastmeals/contracts";
import { apiRequest, toQueryString } from "@/services/api-client";

export type DeliveryPersonFilters = { isActive?: boolean; available?: boolean };

// Mesmo formato de chave do despacho: a lista de "ativos e livres" é o mesmo cache nas duas telas.
export const deliveryPersonKeys = {
  all: ["delivery-persons"] as const,
  list: (filters: DeliveryPersonFilters) => [...deliveryPersonKeys.all, "list", filters] as const,
};

export function fetchDeliveryPersons(filters: DeliveryPersonFilters, signal?: AbortSignal) {
  return apiRequest<DeliveryPersonList>(`/delivery-persons${toQueryString(filters)}`, { signal });
}

export function createDeliveryPerson(input: CreateDeliveryPersonInput) {
  return apiRequest<DeliveryPerson>("/delivery-persons", { method: "POST", body: input });
}

export function updateDeliveryPerson(id: string, input: UpdateDeliveryPersonInput) {
  return apiRequest<DeliveryPerson>(`/delivery-persons/${id}`, { method: "PUT", body: input });
}

export function deleteDeliveryPerson(id: string) {
  return apiRequest<undefined>(`/delivery-persons/${id}`, { method: "DELETE" });
}
