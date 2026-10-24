import type { Order } from "@fastmeals/contracts";
import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { RelativeTime } from "@/design-system/components/relative-time";
import { Skeleton } from "@/design-system/ui/skeleton";
import { StatusBadge } from "@/features/orders";

type AttentionListProps = {
  title: string;
  orders: Order[] | undefined;
  loading: boolean;
  emptyMessage: string;
};

// Os pedidos mais antigos primeiro: quem espera há mais tempo está no topo.
export function AttentionList({ title, orders, loading, emptyMessage }: AttentionListProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      {loading ? (
        <Skeleton className="h-24" />
      ) : orders?.length === 0 ? (
        <p className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2.5 text-ui text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {orders?.map((order) => (
            <li key={order.id}>
              <Link
                to="/orders"
                search={{ order: order.id, status: order.status }}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-ui transition-colors hover:bg-accent/60"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{order.customerName}</span>
                  <span className="text-xs text-muted-foreground">
                    <RelativeTime iso={order.createdAt} />
                  </span>
                </span>
                <StatusBadge status={order.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
