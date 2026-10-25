import { Tooltip } from "@/design-system/ui/tooltip";
import type { RealtimeStatus } from "@/hooks/use-realtime";
import { cn } from "@/utils/cn";

const states = {
  live: {
    label: "Ao vivo",
    dot: "bg-brand",
    hint: "Pedidos, cardápio e entregadores atualizam sozinhos.",
  },
  connecting: {
    label: "Conectando",
    dot: "bg-muted-foreground",
    hint: "Abrindo a conexão de tempo real.",
  },
  offline: {
    label: "Atualização a cada 30 s",
    dot: "bg-warning",
    hint: "Sem conexão de tempo real agora. As telas abertas recarregam a cada 30 s até ela voltar.",
  },
} satisfies Record<RealtimeStatus, { label: string; dot: string; hint: string }>;

// O operador precisa saber se o que vê está ao vivo ou pode estar alguns segundos atrás.
export function LiveIndicator({ status }: { status: RealtimeStatus }) {
  const state = states[status];
  return (
    <Tooltip content={state.hint}>
      <span
        tabIndex={0}
        role="status"
        className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground"
      >
        <span className="relative flex size-2" aria-hidden="true">
          {status === "live" && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
          )}
          <span className={cn("relative inline-flex size-2 rounded-full", state.dot)} />
        </span>
        <span className="hidden sm:inline">{state.label}</span>
        <span className="sr-only sm:hidden">{state.label}</span>
      </span>
    </Tooltip>
  );
}
