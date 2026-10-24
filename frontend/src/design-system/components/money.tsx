import { formatMoney } from "@/utils/format";
import { cn } from "@/utils/cn";

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{formatMoney(value)}</span>;
}
