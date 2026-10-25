import { orderTransitions, type Order, type OrderStatus } from "@fastmeals/contracts";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/design-system/components/confirm-dialog";
import { Button } from "@/design-system/ui/button";
import { Tooltip } from "@/design-system/ui/tooltip";
import { READ_ONLY_MESSAGE, useCan } from "@/hooks/use-can";
import { useChangeOrderStatus } from "../hooks/use-orders";
import { statusMeta } from "./status-badge";

const actionLabels = {
  preparing: "Iniciar preparo",
  ready: "Marcar como pronto",
  delivering: "Saiu para entrega",
  delivered: "Confirmar entrega",
  cancelled: "Cancelar pedido",
} satisfies Record<Exclude<OrderStatus, "pending">, string>;

type ActionTarget = keyof typeof actionLabels;

// Os botões saem da mesma tabela de transições que o backend usa (orderTransitions, em
// contracts): a tela nunca oferece uma transição que o servidor recusaria.
export function OrderActions({ order }: { order: Order }) {
  const canWrite = useCan("orders:write");
  const changeStatus = useChangeOrderStatus();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const targets = orderTransitions[order.status] as readonly ActionTarget[];

  if (targets.length === 0) return null;

  function apply(status: ActionTarget) {
    changeStatus.mutate(
      { id: order.id, status },
      {
        onSuccess: () => {
          setConfirmingCancel(false);
          toast.success(
            `Pedido de ${order.customerName}: ${statusMeta[status].label.toLowerCase()}`,
          );
        },
        onError: (error) => {
          setConfirmingCancel(false);
          toast.error(error.message);
        },
      },
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {targets.map((status) => {
        const needsDeliveryPerson = status === "delivering" && order.deliveryPerson === null;
        const blockedReason = !canWrite
          ? READ_ONLY_MESSAGE
          : needsDeliveryPerson
            ? "Atribua um entregador na tela de despacho antes de sair para entrega"
            : null;
        const button = (
          <Button
            variant={status === "cancelled" ? "secondary" : "primary"}
            className={status === "cancelled" ? "text-destructive-text" : undefined}
            disabled={blockedReason !== null || changeStatus.isPending}
            onClick={() => (status === "cancelled" ? setConfirmingCancel(true) : apply(status))}
          >
            {actionLabels[status]}
          </Button>
        );
        // Botão desabilitado não recebe foco nem hover: o span deixa o motivo aparecer.
        return blockedReason ? (
          <Tooltip key={status} content={blockedReason}>
            <span tabIndex={0} className="rounded-md">
              {button}
            </span>
          </Tooltip>
        ) : (
          <span key={status}>{button}</span>
        );
      })}

      <ConfirmDialog
        open={confirmingCancel}
        onOpenChange={setConfirmingCancel}
        title="Cancelar este pedido?"
        description={`O pedido de ${order.customerName} sai da fila e não pode ser reaberto.`}
        confirmLabel="Cancelar pedido"
        tone="danger"
        pending={changeStatus.isPending}
        onConfirm={() => apply("cancelled")}
      />
    </div>
  );
}
