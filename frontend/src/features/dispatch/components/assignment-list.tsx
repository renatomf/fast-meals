import type { OptimizeAssignmentResponse } from "@fastmeals/contracts";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/design-system/ui/button";
import { Tooltip } from "@/design-system/ui/tooltip";
import { READ_ONLY_MESSAGE } from "@/hooks/use-can";
import { cn } from "@/utils/cn";

type Assignment = OptimizeAssignmentResponse["assignments"][number];
export type Decision = "accepted" | "rejected";

type AssignmentListProps = {
  assignments: Assignment[];
  decisions: Record<string, Decision>;
  customerNames: Map<string, string>;
  canWrite: boolean;
  activeOrderId?: string;
  onActivate: (orderId: string | undefined) => void;
  onAccept: (assignment: Assignment) => void;
  onReject: (assignment: Assignment) => void;
};

function km(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`;
}

// Cada sugestão é uma decisão do operador: aceitar atribui e manda para entrega; rejeitar só
// tira da lista, e o par volta a concorrer na próxima otimização.
export function AssignmentList({
  assignments,
  decisions,
  customerNames,
  canWrite,
  activeOrderId,
  onActivate,
  onAccept,
  onReject,
}: AssignmentListProps) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Sugestões de atribuição">
      {assignments.map((assignment, index) => {
        const decision = decisions[assignment.orderId];
        const customer = customerNames.get(assignment.orderId) ?? "Pedido";
        const accepted = decision === "accepted";

        const actions = (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              disabled={!canWrite || accepted}
              onClick={() => onAccept(assignment)}
              aria-label={`Aceitar: ${assignment.deliveryPersonName} leva o pedido de ${customer}`}
            >
              <Check /> Aceitar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!canWrite || accepted}
              onClick={() => onReject(assignment)}
              aria-label={`Rejeitar: ${assignment.deliveryPersonName} para o pedido de ${customer}`}
            >
              <X /> Rejeitar
            </Button>
          </div>
        );

        return (
          <li
            key={assignment.orderId}
            onMouseEnter={() => onActivate(assignment.orderId)}
            onMouseLeave={() => onActivate(undefined)}
            // As sugestões entram em sequência, de cima para baixo (no máximo ~0,5 s no total).
            style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-3 transition-[background-color,border-color,opacity] duration-150",
              "animate-in [animation-fill-mode:both] fade-in-0 slide-in-from-left-2 duration-300",
              activeOrderId === assignment.orderId && "border-brand bg-brand-subtle/50",
              accepted && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-x-1.5 text-ui font-semibold">
                  {assignment.deliveryPersonName}
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>{customer}</span>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {assignment.orderAddress}
                </span>
              </div>
              <span className="shrink-0 text-ui font-semibold tabular-nums">
                {km(assignment.estimatedDistanceKm)}
              </span>
            </div>
            {accepted ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-text">
                <Check className="size-3.5" aria-hidden="true" /> Saiu para entrega
              </span>
            ) : canWrite ? (
              actions
            ) : (
              <Tooltip content={READ_ONLY_MESSAGE}>
                <span tabIndex={0} className="self-start rounded-md">
                  {actions}
                </span>
              </Tooltip>
            )}
          </li>
        );
      })}
    </ul>
  );
}
