import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/design-system/ui/button";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

// O que aconteceu e como tentar de novo; nunca uma tela branca.
export function ErrorState({
  title = "Não foi possível carregar",
  message = "Verifique sua conexão e tente novamente.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive-text">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <div className="max-w-sm">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-ui text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RotateCw /> Tentar novamente
        </Button>
      )}
    </div>
  );
}
