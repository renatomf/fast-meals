import type { ReactNode } from "react";
import { Skeleton } from "@/design-system/ui/skeleton";
import { cn } from "@/utils/cn";

type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  // Cor do hint: positivo, negativo ou neutro. Quem decide o que é bom é a tela.
  tone?: "positive" | "negative" | "neutral";
  loading?: boolean;
};

const tones = {
  positive: "text-success",
  negative: "text-destructive-text",
  neutral: "text-muted-foreground",
} as const;

// Um número grande por cartão (padrão Stripe e Mercury).
export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  loading = false,
}: MetricCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {loading ? (
        <>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24" />
        </>
      ) : (
        <>
          <span className="animate-in text-2xl font-bold tracking-tight tabular-nums fade-in-0 duration-300">
            {value}
          </span>
          {hint && <span className={cn("text-xs font-semibold", tones[tone])}>{hint}</span>}
        </>
      )}
    </div>
  );
}
