import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";

// Borda de 1px faz o trabalho de separar; sombra fica para o que flutua (dialog, sheet).
export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-lg border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      // Título e descrição empilham no celular; lado a lado só quando há espaço.
      className={cn(
        "flex flex-col gap-1 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("text-sm font-semibold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-0.5 text-ui text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}
