// Legenda curta abaixo de um gráfico diário: explica sem hover por que o último ponto
// parece baixo. A amostra repete o traço do gráfico (tracejado na área, barra clara nas barras).
export function PartialDayNote({ sample }: { sample: "dashed" | "faded" }) {
  return (
    <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      {sample === "dashed" ? (
        <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-chart-1" />
      ) : (
        <span aria-hidden="true" className="size-2.5 rounded-sm bg-chart-1/40" />
      )}
      Hoje ainda está em andamento: o valor sobe até o fim do dia.
    </p>
  );
}
