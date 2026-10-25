import type { Product } from "@fastmeals/contracts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/design-system/components/confirm-dialog";
import { ErrorState } from "@/design-system/components/error-state";
import { PageHeader } from "@/design-system/components/page-header";
import { Pagination } from "@/design-system/components/pagination";
import { Button } from "@/design-system/ui/button";
import { Card } from "@/design-system/ui/card";
import { Tooltip } from "@/design-system/ui/tooltip";
import { READ_ONLY_MESSAGE, useCan } from "@/hooks/use-can";
import { ApiError } from "@/services/api-client";
import { ProductFilters } from "../components/product-filters";
import { ProductFormSheet } from "../components/product-form-sheet";
import { ProductsTable } from "../components/products-table";
import { useDeleteProduct, useProducts, useToggleAvailability } from "../hooks/use-products";
import type { ProductsSearch } from "../search-params";

const PAGE_SIZE = 20;

export function ProductsPage() {
  const search = useSearch({ from: "/app/products" });
  const navigate = useNavigate({ from: "/products" });
  const canWrite = useCan("products:write");
  const page = search.page ?? 1;

  // undefined: formulário fechado; null: produto novo.
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const products = useProducts({
    page,
    limit: PAGE_SIZE,
    search: search.search,
    category: search.category,
    isAvailable:
      search.availability === undefined ? undefined : search.availability === "available",
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
  });
  const toggle = useToggleAvailability();
  const remove = useDeleteProduct();

  function updateSearch(changes: Partial<ProductsSearch>) {
    void navigate({ search: (previous) => ({ ...previous, ...changes }) });
  }

  function toggleAvailability(product: Product, isAvailable: boolean) {
    toggle.mutate(
      { id: product.id, isAvailable },
      {
        onError: (error) => toast.error(`${product.name}: ${error.message}`),
      },
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    const product = deleting;
    remove.mutate(product.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success(`${product.name} excluído do cardápio`);
      },
      onError: (error) => {
        setDeleting(null);
        // 409: o produto está num pedido em aberto. Marcar como indisponível é o caminho.
        toast.error(
          error instanceof ApiError && error.code === "PRODUCT_IN_USE"
            ? `${product.name} está em pedidos em andamento. Marque como indisponível em vez de excluir.`
            : error.message,
        );
      },
    });
  }

  const newButton = (
    <Button onClick={() => setEditing(null)} disabled={!canWrite}>
      <Plus /> Novo produto
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cardápio"
        description="Produtos, preços e disponibilidade."
        actions={
          canWrite ? (
            newButton
          ) : (
            <Tooltip content={READ_ONLY_MESSAGE}>
              <span tabIndex={0} className="rounded-md">
                {newButton}
              </span>
            </Tooltip>
          )
        }
      />

      <Card className="overflow-hidden">
        <ProductFilters search={search} onChange={updateSearch} />
        {products.isError ? (
          <ErrorState message={products.error.message} onRetry={() => void products.refetch()} />
        ) : (
          <>
            <ProductsTable
              products={products.data?.data}
              loading={products.isLoading}
              canWrite={canWrite}
              onToggle={toggleAvailability}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
            {products.data && products.data.pagination.total > 0 && (
              <div className="border-t">
                <Pagination
                  page={page}
                  totalPages={products.data.pagination.totalPages}
                  total={products.data.pagination.total}
                  onPageChange={(next) => updateSearch({ page: next })}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <ProductFormSheet product={editing} onClose={() => setEditing(undefined)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir este produto?"
        description={`${deleting?.name ?? "O produto"} sai do cardápio. Pedidos já entregues continuam com o registro.`}
        confirmLabel="Excluir produto"
        tone="danger"
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
