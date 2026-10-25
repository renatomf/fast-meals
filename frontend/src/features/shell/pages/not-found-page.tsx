import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { EmptyState } from "@/design-system/components/empty-state";
import { Button } from "@/design-system/ui/button";

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60svh] place-items-center">
      <EmptyState
        icon={Compass}
        title="Página não encontrada"
        description="O endereço pode ter mudado ou o link estar incompleto."
        action={
          <Button asChild variant="secondary">
            <Link to="/">Voltar para a visão geral</Link>
          </Button>
        }
      />
    </div>
  );
}
