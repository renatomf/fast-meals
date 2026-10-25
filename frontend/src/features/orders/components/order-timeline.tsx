import type { OrderHistory } from "@fastmeals/contracts";
import { Skeleton } from "@/design-system/ui/skeleton";
import { formatDateTime } from "@/utils/format";
import { statusMeta } from "./status-badge";

type OrderTimelineProps = { history: OrderHistory["data"] | undefined; loading: boolean };

// Cada mudança de status com quando e quem fez (order_status_history).
export function OrderTimeline({ history, loading }: OrderTimelineProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col gap-4 border-l pl-5">
      {history?.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            aria-hidden="true"
            className={`absolute top-1 -left-[25px] size-2.5 rounded-full ring-4 ring-popover ${statusMeta[entry.toStatus].dot}`}
          />
          <p className="text-ui font-semibold">
            {entry.fromStatus === null ? "Pedido criado" : statusMeta[entry.toStatus].label}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatDateTime(entry.changedAt)}
            {entry.changedBy && ` · ${entry.changedBy.email}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
