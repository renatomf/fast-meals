import { useNavigate, useSearch } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ErrorState } from "@/design-system/components/error-state";
import { PageHeader } from "@/design-system/components/page-header";
import { Pagination } from "@/design-system/components/pagination";
import { Button } from "@/design-system/ui/button";
import { Card } from "@/design-system/ui/card";
import { Tooltip } from "@/design-system/ui/tooltip";
import { READ_ONLY_MESSAGE, useCan } from "@/hooks/use-can";
import { NewOrderSheet } from "../components/new-order-sheet";
import { OrderDetailsSheet } from "../components/order-details-sheet";
import { OrderFilters } from "../components/order-filters";
import { OrdersTable } from "../components/orders-table";
import { useOrders } from "../hooks/use-orders";
import type { OrdersSearch } from "../search-params";

const PAGE_SIZE = 20;

// A página compõe: os hooks buscam, os componentes apresentam, a URL guarda o estado.
export function OrdersPage() {
  const search = useSearch({ from: "/app/orders" });
  const navigate = useNavigate({ from: "/orders" });
  const canWrite = useCan("orders:write");
  const [creating, setCreating] = useState(false);
  const page = search.page ?? 1;

  const orders = useOrders({
    page,
    limit: PAGE_SIZE,
    status: search.status,
    startDate: search.startDate,
    endDate: search.endDate,
  });

  function updateSearch(changes: Partial<OrdersSearch>) {
    void navigate({ search: (previous) => ({ ...previous, ...changes }) });
  }

  const newOrderButton = (
    <Button onClick={() => setCreating(true)} disabled={!canWrite}>
      <Plus /> Novo pedido
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pedidos"
        description="Acompanhe a fila, mude o status e veja o histórico de cada pedido."
        actions={
          canWrite ? (
            newOrderButton
          ) : (
            <Tooltip content={READ_ONLY_MESSAGE}>
              <span tabIndex={0} className="rounded-md">
                {newOrderButton}
              </span>
            </Tooltip>
          )
        }
      />

      <Card className="overflow-hidden">
        <OrderFilters search={search} onChange={updateSearch} />
        {orders.isError ? (
          <ErrorState message={orders.error.message} onRetry={() => void orders.refetch()} />
        ) : (
          <>
            <OrdersTable
              orders={orders.data?.data}
              loading={orders.isLoading}
              onOpen={(order) => updateSearch({ order: order.id })}
            />
            {orders.data && orders.data.pagination.total > 0 && (
              <div className="border-t">
                <Pagination
                  page={page}
                  totalPages={orders.data.pagination.totalPages}
                  total={orders.data.pagination.total}
                  onPageChange={(next) => updateSearch({ page: next })}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <OrderDetailsSheet
        orderId={search.order}
        onClose={() => updateSearch({ order: undefined })}
      />
      <NewOrderSheet
        open={creating}
        onOpenChange={setCreating}
        onCreated={(orderId) =>
          updateSearch({ order: orderId, page: undefined, status: undefined })
        }
      />
    </div>
  );
}
