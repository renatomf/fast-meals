import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiStatus } from "@/components/api-status";
import { ThemeToggle } from "@/components/theme-toggle";

const statuses = [
  { label: "Pendente", className: "bg-status-pending" },
  { label: "Em preparo", className: "bg-status-preparing" },
  { label: "Pronto", className: "bg-status-ready" },
  { label: "Em entrega", className: "bg-status-delivering" },
  { label: "Entregue", className: "bg-status-delivered" },
  { label: "Cancelado", className: "bg-status-cancelled" },
];

// Tela provisória do dia 1: confirma tokens, temas e integração com a API.
// Dá lugar ao app shell no dia 5.
export function App() {
  return (
    <div className="min-h-svh">
      <header className="flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6">
        <span className="text-sm font-semibold tracking-tight">FastMeals</span>
        <div className="flex items-center gap-2">
          <ApiStatus />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fundação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tokens, temas e primitivos do design system.
          </p>
        </div>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-medium">Status de pedido</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {statuses.map((status) => (
              <li
                key={status.label}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs"
              >
                <span aria-hidden className={`size-2 rounded-full ${status.className}`} />
                {status.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-medium">Ações</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button>
              <Plus /> Novo pedido
            </Button>
            <Button variant="secondary">Exportar</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="danger">Excluir</Button>
            <Button size="sm" variant="secondary">
              Compacto
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground tabular-nums">
            Receita do período: <span className="font-medium text-foreground">R$ 48.250,90</span>
          </p>
        </section>
      </main>
    </div>
  );
}
