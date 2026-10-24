import type { Order } from "@fastmeals/contracts";
import { ClipboardList } from "lucide-react";
import type { ReactNode } from "react";
import { DataTable, type DataTableColumn } from "@/design-system/components/data-table";
import { EmptyState } from "@/design-system/components/empty-state";
import { Money } from "@/design-system/components/money";
import { RelativeTime } from "@/design-system/components/relative-time";
import { Skeleton } from "@/design-system/ui/skeleton";
import { StatusBadge } from "./status-badge";

function itemsSummary(order: Order): string {
  return order.items.map((item) => `${item.quantity}× ${item.product.name}`).join(", ");
}

const columns: DataTableColumn<Order>[] = [
  {
    id: "customer",
    header: "Cliente",
    cell: (order) => (
      <div className="flex flex-col">
        <span className="font-semibold">{order.customerName}</span>
        <span className="text-xs text-muted-foreground">{order.customerPhone}</span>
      </div>
    ),
  },
  {
    id: "items",
    header: "Itens",
    // Truncado na tabela, inteiro no title: nenhum texto cortado sem como ler.
    cell: (order) => (
      <span title={itemsSummary(order)} className="block max-w-72 truncate text-muted-foreground">
        {itemsSummary(order)}
      </span>
    ),
  },
  { id: "status", header: "Status", cell: (order) => <StatusBadge status={order.status} /> },
  {
    id: "deliveryPerson",
    header: "Entregador",
    cell: (order) => order.deliveryPerson?.name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    id: "total",
    header: "Total",
    align: "right",
    cell: (order) => <Money value={order.totalAmount} className="font-semibold" />,
  },
  {
    id: "createdAt",
    header: "Criado",
    align: "right",
    cell: (order) => (
      <span className="text-muted-foreground">
        <RelativeTime iso={order.createdAt} />
      </span>
    ),
  },
];

type OrdersTableProps = {
  orders: Order[] | undefined;
  loading: boolean;
  onOpen: (order: Order) => void;
  emptyAction?: ReactNode;
};

const empty = (action?: ReactNode) => (
  <EmptyState
    icon={ClipboardList}
    title="Nenhum pedido encontrado"
    description="Ajuste os filtros ou o período para ver outros pedidos."
    action={action}
  />
);

// Tabela no desktop; no celular a mesma informação vira uma lista de cartões.
export function OrdersTable({ orders, loading, onOpen, emptyAction }: OrdersTableProps) {
  return (
    <>
      <div className="hidden md:block">
        <DataTable
          caption="Pedidos"
          columns={columns}
          rows={orders}
          getRowKey={(order) => order.id}
          loading={loading}
          onRowClick={onOpen}
          emptyState={empty(emptyAction)}
        />
      </div>

      <ul className="divide-y md:hidden">
        {loading &&
          Array.from({ length: 5 }, (_, index) => (
            <li key={index} className="p-4">
              <Skeleton className="h-14" />
            </li>
          ))}
        {!loading && orders?.length === 0 && <li>{empty(emptyAction)}</li>}
        {!loading &&
          orders?.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => onOpen(order)}
                className="flex w-full flex-col gap-1.5 p-4 text-left transition-colors hover:bg-accent/60"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{order.customerName}</span>
                  <Money value={order.totalAmount} className="font-semibold" />
                </span>
                <span className="truncate text-ui text-muted-foreground">
                  {itemsSummary(order)}
                </span>
                <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <StatusBadge status={order.status} />
                  <RelativeTime iso={order.createdAt} />
                </span>
              </button>
            </li>
          ))}
      </ul>
    </>
  );
}
