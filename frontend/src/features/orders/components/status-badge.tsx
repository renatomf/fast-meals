import type { OrderStatus } from "@fastmeals/contracts";
import { cn } from "@/utils/cn";

// Um lugar só para rótulo e cor de cada status. Com "satisfies Record<OrderStatus, ...>",
// um status novo nos contratos quebra a compilação até ganhar rótulo e cor aqui.
export const statusMeta = {
  pending: {
    label: "Pendente",
    className: "bg-status-pending-subtle text-status-pending",
    dot: "bg-status-pending",
  },
  preparing: {
    label: "Em preparo",
    className: "bg-status-preparing-subtle text-status-preparing",
    dot: "bg-status-preparing",
  },
  ready: {
    label: "Pronto",
    className: "bg-status-ready-subtle text-status-ready",
    dot: "bg-status-ready",
  },
  delivering: {
    label: "Em entrega",
    className: "bg-status-delivering-subtle text-status-delivering",
    dot: "bg-status-delivering",
  },
  delivered: {
    label: "Entregue",
    className: "bg-status-delivered-subtle text-status-delivered",
    dot: "bg-status-delivered",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-status-cancelled-subtle text-status-cancelled",
    dot: "bg-status-cancelled",
  },
} satisfies Record<OrderStatus, { label: string; className: string; dot: string }>;

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = statusMeta[status];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        meta.className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}
