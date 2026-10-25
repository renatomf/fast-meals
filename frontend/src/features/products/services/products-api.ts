import type {
  CreateProductInput,
  Product,
  ProductCategory,
  ProductList,
  UpdateProductInput,
} from "@fastmeals/contracts";
import { apiRequest, toQueryString } from "@/services/api-client";

export type ProductFilters = {
  page?: number;
  limit?: number;
  search?: string;
  category?: ProductCategory;
  isAvailable?: boolean;
  sortBy?: "name" | "price" | "createdAt";
  sortOrder?: "asc" | "desc";
};

// O prefixo ["products"] também cobre a lista de produtos do formulário de novo pedido.
export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
};

export function fetchProducts(filters: ProductFilters, signal?: AbortSignal) {
  return apiRequest<ProductList>(`/products${toQueryString(filters)}`, { signal });
}

export function createProduct(input: CreateProductInput) {
  return apiRequest<Product>("/products", { method: "POST", body: input });
}

export function updateProduct(id: string, input: UpdateProductInput) {
  return apiRequest<Product>(`/products/${id}`, { method: "PUT", body: input });
}

export function deleteProduct(id: string) {
  return apiRequest<undefined>(`/products/${id}`, { method: "DELETE" });
}
