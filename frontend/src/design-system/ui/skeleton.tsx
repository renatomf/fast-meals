import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";

// O esqueleto tem o formato do conteúdo real: a tela não salta quando os dados chegam.
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
