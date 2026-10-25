import type { OptimizeAssignmentResponse } from "@fastmeals/contracts";
import { Grid3x3 } from "lucide-react";
import { Button } from "@/design-system/ui/button";
import { formatDecimal } from "@/utils/format";

type SuggestionSummaryProps = {
  suggestion: OptimizeAssignmentResponse;
  onOpenMatrix?: () => void;
};

function km(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} km`;
}

// O card "ótimo × guloso": mostra o que o algoritmo ganhou sobre a escolha óbvia de mandar
// cada pedido para o entregador mais perto.
export function SuggestionSummary({ suggestion, onOpenMatrix }: SuggestionSummaryProps) {
  const optimal = suggestion.totalDistanceKm;
  const greedy = suggestion.baseline.totalDistanceKm;
  const saved = greedy - optimal;
  const savedShare = greedy > 0 ? saved / greedy : 0;
  const greedyWidth = greedy > 0 ? 100 : 0;
  const optimalWidth = greedy > 0 ? (optimal / greedy) * 100 : 0;

  return (
    <section aria-label="Resumo da sugestão" className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Distância total</h2>
        <span className="text-xs text-muted-foreground">
          calculado em {formatDecimal(suggestion.executionTimeMs)} ms
        </span>
      </div>

      <dl className="flex flex-col gap-2 text-ui">
        {/* dt e dd filhos diretos de cada grupo: a barra vai num dd extra, escondido do leitor. */}
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          <dt className="font-medium">Húngaro (ótimo)</dt>
          <dd className="font-semibold tabular-nums">{km(optimal)}</dd>
          <dd className="col-span-2 h-2 rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-brand" style={{ width: `${optimalWidth}%` }} />
          </dd>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Guloso (mais perto primeiro)</dt>
          <dd className="tabular-nums text-muted-foreground">{km(greedy)}</dd>
          <dd className="col-span-2 h-2 rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-muted-foreground/40"
              style={{ width: `${greedyWidth}%` }}
            />
          </dd>
        </div>
      </dl>

      <p className="text-ui">
        {saved > 0.005 ? (
          <>
            <span className="font-semibold text-brand-text">
              {km(saved)} a menos ({formatDecimal(savedShare * 100)}%)
            </span>{" "}
            que mandar cada pedido para o entregador mais próximo.
          </>
        ) : (
          "Desta vez o guloso chegou ao mesmo total: não havia disputa entre pedidos pelo mesmo entregador."
        )}
      </p>

      {onOpenMatrix && (
        <Button variant="secondary" size="sm" className="self-start" onClick={onOpenMatrix}>
          <Grid3x3 /> Ver matriz de distâncias
        </Button>
      )}
    </section>
  );
}
