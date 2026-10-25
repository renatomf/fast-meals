import type { ProductList } from "@fastmeals/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Bike,
  ClipboardList,
  CornerDownLeft,
  LayoutDashboard,
  LogOut,
  Moon,
  PackageCheck,
  Route,
  Search,
  Timer,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/design-system/theme/theme-provider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/design-system/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiRequest, toQueryString } from "@/services/api-client";
import { cn } from "@/utils/cn";
import { formatMoney } from "@/utils/format";

type Command = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
};

type CommandPaletteProps = { open: boolean; onOpenChange: (open: boolean) => void };

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Ctrl+K (⌘K no Mac): navegar, abrir as filas mais usadas e achar um produto sem tirar a mão
// do teclado. Combobox ARIA: o foco fica no campo, as setas movem a opção ativa e o leitor
// de tela acompanha por aria-activedescendant.
function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const search = useDebouncedValue(query.trim(), 200);

  const products = useQuery({
    queryKey: ["products", "list", { search, limit: 5, palette: true }],
    queryFn: ({ signal }) =>
      apiRequest<ProductList>(`/products${toQueryString({ search, limit: 5 })}`, { signal }),
    enabled: search.length >= 2,
    placeholderData: keepPreviousData,
  });

  const commands = useMemo<Command[]>(() => {
    const go = (run: () => void) => () => {
      onClose();
      run();
    };
    const fixed: Command[] = [
      {
        id: "home",
        group: "Ir para",
        label: "Visão geral",
        icon: LayoutDashboard,
        run: go(() => void navigate({ to: "/" })),
      },
      {
        id: "orders",
        group: "Ir para",
        label: "Pedidos",
        icon: ClipboardList,
        run: go(() => void navigate({ to: "/orders" })),
      },
      {
        id: "dispatch",
        group: "Ir para",
        label: "Despacho",
        icon: Route,
        keywords: "atribuir entregador mapa",
        run: go(() => void navigate({ to: "/dispatch" })),
      },
      {
        id: "products",
        group: "Ir para",
        label: "Cardápio",
        icon: UtensilsCrossed,
        keywords: "produtos",
        run: go(() => void navigate({ to: "/products" })),
      },
      {
        id: "couriers",
        group: "Ir para",
        label: "Entregadores",
        icon: Bike,
        keywords: "motoboy",
        run: go(() => void navigate({ to: "/delivery-persons" })),
      },
      {
        id: "reports",
        group: "Ir para",
        label: "Relatórios",
        icon: BarChart3,
        keywords: "receita gráficos",
        run: go(() => void navigate({ to: "/reports" })),
      },
      {
        id: "pending",
        group: "Filas",
        label: "Pedidos pendentes",
        icon: Timer,
        run: go(() => void navigate({ to: "/orders", search: { status: "pending" } })),
      },
      {
        id: "ready",
        group: "Filas",
        label: "Pedidos prontos para despacho",
        icon: PackageCheck,
        run: go(() => void navigate({ to: "/orders", search: { status: "ready" } })),
      },
      {
        id: "theme",
        group: "Preferências",
        label: theme === "dark" ? "Usar tema claro" : "Usar tema escuro",
        icon: Moon,
        keywords: "dark mode tema",
        run: go(toggleTheme),
      },
      {
        id: "logout",
        group: "Preferências",
        label: "Sair",
        icon: LogOut,
        run: go(() => void logout()),
      },
    ];
    const term = normalize(query.trim());
    const matches = term
      ? fixed.filter((command) =>
          normalize(`${command.label} ${command.keywords ?? ""}`).includes(term),
        )
      : fixed;
    const found: Command[] =
      search.length >= 2
        ? (products.data?.data ?? []).map((product) => ({
            id: `product-${product.id}`,
            group: "Produtos",
            label: product.name,
            hint: formatMoney(product.price),
            icon: UtensilsCrossed,
            run: go(() => void navigate({ to: "/products", search: { search: product.name } })),
          }))
        : [];
    return [...matches, ...found];
  }, [query, search, products.data, theme, toggleTheme, logout, navigate, onClose]);

  const activeCommand = commands[Math.min(active, commands.length - 1)];
  const optionId = (command: Command) => `${listId}-${command.id}`;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (commands.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + commands.length) % commands.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      activeCommand?.run();
    }
  }

  const groups = [...new Set(commands.map((command) => command.group))];

  return (
    <>
      <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
      <DialogDescription className="sr-only">
        Digite para filtrar. Setas escolhem, Enter executa, Esc fecha.
      </DialogDescription>
      <div className="flex items-center gap-2 border-b px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={activeCommand ? optionId(activeCommand) : undefined}
          aria-autocomplete="list"
          aria-label="Buscar telas, filas ou produtos"
          placeholder="Buscar telas, filas ou produtos…"
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            // Lista nova, opção ativa volta para o topo.
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label="Resultados"
        className="max-h-80 overflow-y-auto p-2"
      >
        {commands.length === 0 && (
          <p className="px-3 py-6 text-center text-ui text-muted-foreground">
            {products.isFetching ? "Buscando…" : "Nada encontrado."}
          </p>
        )}
        {groups.map((group) => (
          <div key={group} role="group" aria-label={group} className="flex flex-col pb-1">
            <span
              className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground"
              aria-hidden="true"
            >
              {group}
            </span>
            {commands
              .filter((command) => command.group === group)
              .map((command) => {
                const selected = command === activeCommand;
                const Icon = command.icon;
                return (
                  <div
                    key={command.id}
                    id={optionId(command)}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => setActive(commands.indexOf(command))}
                    onClick={command.run}
                    className={cn(
                      "flex h-9 cursor-pointer items-center gap-3 rounded-md px-3 text-ui",
                      selected && "bg-accent text-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1 truncate">{command.label}</span>
                    {command.hint && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {command.hint}
                      </span>
                    )}
                    {selected && (
                      <CornerDownLeft
                        className="size-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </>
  );
}

// O conteúdo só existe com a paleta aberta: cada abertura começa com a busca vazia e a
// primeira opção ativa, sem efeito para reiniciar o estado.
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15svh] max-w-lg translate-y-0 gap-0 overflow-hidden p-0 [&>button:last-child]:hidden">
        {open && <PaletteBody onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
