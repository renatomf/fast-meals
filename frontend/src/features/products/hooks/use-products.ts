import type { CreateProductInput, ProductList, UpdateProductInput } from "@fastmeals/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  productKeys,
  updateProduct,
  type ProductFilters,
} from "../services/products-api";

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: ({ signal }) => fetchProducts(filters, signal),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateProducts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: productKeys.all });
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: invalidate,
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      updateProduct(id, input),
    onSuccess: invalidate,
  });
}

type Toggle = { id: string; isAvailable: boolean };
type Snapshot = [readonly unknown[], ProductList | undefined][];

// O interruptor muda na hora em todas as listas carregadas; se a API recusar, volta.
export function useToggleAvailability() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, Toggle, Snapshot>({
    mutationFn: ({ id, isAvailable }) => updateProduct(id, { isAvailable }),
    onMutate: async ({ id, isAvailable }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() });
      const snapshot = queryClient.getQueriesData<ProductList>({ queryKey: productKeys.lists() });
      queryClient.setQueriesData<ProductList>({ queryKey: productKeys.lists() }, (list) =>
        list
          ? {
              ...list,
              data: list.data.map((product) =>
                product.id === id ? { ...product, isAvailable } : product,
              ),
            }
          : list,
      );
      return snapshot;
    },
    onError: (_error, _toggle, snapshot) => {
      for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: invalidate,
  });
}
