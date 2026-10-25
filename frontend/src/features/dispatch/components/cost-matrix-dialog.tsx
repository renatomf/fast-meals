import type { OptimizeAssignmentResponse } from "@fastmeals/contracts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { cn } from "@/utils/cn";

type CostMatrix = NonNullable<OptimizeAssignmentResponse["costMatrix"]>;

type CostMatrixDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matrix: CostMatrix;
  assignments: OptimizeAssignmentResponse["assignments"];
  customerNames: Map<string, string>;
  courierNames: Map<string, string>;
};

// Heatmap da matriz que o Húngaro recebeu: linhas são pedidos, colunas são entregadores,
// a cor cresce com a distância. As células escolhidas ficam contornadas: dá para ver por que
// o ótimo às vezes ignora o par mais próximo de um pedido.
export function CostMatrixDialog({
  open,
  onOpenChange,
  matrix,
  assignments,
  customerNames,
  courierNames,
}: CostMatrixDialogProps) {
  const chosen = new Set(
    assignments.map((assignment) => `${assignment.orderId}:${assignment.deliveryPersonId}`),
  );
  const values = matrix.distancesKm.flat();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const intensity = (value: number) => (max === min ? 0.2 : (value - min) / (max - min));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] max-w-[min(64rem,calc(100%-2rem))] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Matriz de distâncias</DialogTitle>
          <DialogDescription>
            Distância em km de cada entregador até cada pedido. Quanto mais escura a célula, mais
            longe. Contornadas: as atribuições escolhidas.
          </DialogDescription>
        </DialogHeader>
        {/* Rolável e focável: pelo teclado, as setas percorrem a tabela inteira. */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Tabela de distâncias"
          className="min-h-0 overflow-auto rounded-md border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <table className="border-collapse text-xs tabular-nums">
            <caption className="sr-only">
              Distância em quilômetros entre cada pedido (linhas) e cada entregador (colunas)
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sticky top-0 left-0 z-20 bg-card p-2 text-left">
                  Pedido
                </th>
                {matrix.deliveryPersonIds.map((id) => (
                  <th
                    key={id}
                    scope="col"
                    className="sticky top-0 z-10 bg-card p-2 text-left font-medium whitespace-nowrap"
                  >
                    {courierNames.get(id) ?? "Entregador"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.orderIds.map((orderId, row) => (
                <tr key={orderId}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-card p-2 text-left font-medium whitespace-nowrap"
                  >
                    {customerNames.get(orderId) ?? "Pedido"}
                  </th>
                  {matrix.deliveryPersonIds.map((courierId, column) => {
                    const value = matrix.distancesKm[row]?.[column] ?? 0;
                    const selected = chosen.has(`${orderId}:${courierId}`);
                    return (
                      <td
                        key={courierId}
                        className={cn(
                          "min-w-14 border border-background p-2 text-right",
                          selected && "font-bold outline-2 -outline-offset-2 outline-foreground",
                        )}
                        style={{
                          backgroundColor: `color-mix(in oklab, var(--chart-3) ${Math.round(
                            intensity(value) * 55,
                          )}%, transparent)`,
                        }}
                      >
                        {value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                        {selected && <span className="sr-only"> (escolhida)</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
