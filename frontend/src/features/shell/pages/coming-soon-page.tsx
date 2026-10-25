import { Hammer } from "lucide-react";
import { EmptyState } from "@/design-system/components/empty-state";
import { PageHeader } from "@/design-system/components/page-header";

// Rotas que ganham tela no dia 6 (despacho, cardápio, entregadores, relatórios).
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <div className="rounded-lg border bg-card">
        <EmptyState
          icon={Hammer}
          title="Em construção"
          description="Esta tela chega na próxima etapa."
        />
      </div>
    </div>
  );
}
