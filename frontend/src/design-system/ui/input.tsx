import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";

export const fieldClasses = cn(
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs",
  "transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
  "dark:bg-card",
);

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(fieldClasses, className)} {...props} />;
}

// Select nativo: teclado, leitor de tela e celular funcionam sem esforço, e as listas do
// painel (status, categoria, veículo) são curtas.
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClasses, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClasses, "h-auto min-h-20 py-2", className)} {...props} />;
}
