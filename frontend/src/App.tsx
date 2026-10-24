import { Plus, Sparkles } from "lucide-react";
import { Logo } from "@/design-system/brand/logo";
import { ThemeToggle } from "@/design-system/components/theme-toggle";
import { Button } from "@/design-system/ui/button";

const statuses = [
  { label: "Pendente", className: "bg-status-pending-subtle text-status-pending" },
  { label: "Em preparo", className: "bg-status-preparing-subtle text-status-preparing" },
  { label: "Pronto", className: "bg-status-ready-subtle text-status-ready" },
  { label: "Em entrega", className: "bg-status-delivering-subtle text-status-delivering" },
  { label: "Entregue", className: "bg-status-delivered-subtle text-status-delivered" },
  { label: "Cancelado", className: "bg-status-cancelled-subtle text-status-cancelled" },
];

// Vitrine provisória do design system nos dois temas. Dá lugar ao app shell ainda no dia 5.
export function App() {
  return (
    <div className="min-h-svh">
      <header className="flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Design system</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verde de marca para identidade e seleção; ações principais em preto.
          </p>
        </div>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-medium">Status de pedido</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {statuses.map((status) => (
              <li
                key={status.label}
                className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${status.className}`}
              >
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
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
            <Button variant="brand">
              <Sparkles /> Sugerir atribuição
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
