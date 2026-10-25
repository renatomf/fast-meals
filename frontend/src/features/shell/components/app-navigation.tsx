import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Bike,
  ClipboardList,
  LayoutDashboard,
  Route,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Tooltip } from "@/design-system/ui/tooltip";
import { cn } from "@/utils/cn";

type NavigationItem = {
  to: "/" | "/orders" | "/dispatch" | "/products" | "/delivery-persons" | "/reports";
  label: string;
  icon: LucideIcon;
};

const items: NavigationItem[] = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/orders", label: "Pedidos", icon: ClipboardList },
  { to: "/dispatch", label: "Despacho", icon: Route },
  { to: "/products", label: "Cardápio", icon: UtensilsCrossed },
  { to: "/delivery-persons", label: "Entregadores", icon: Bike },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
];

type AppNavigationProps = {
  onNavigate?: () => void;
  // Barra recolhida: só ícones; o nome aparece na tooltip e continua no nome acessível.
  collapsed?: boolean;
};

// Item ativo em verde (marca), o resto neutro: a única cor da navegação diz onde você está.
export function AppNavigation({ onNavigate, collapsed = false }: AppNavigationProps) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon }) => {
        const link = (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact: to === "/" }}
            aria-label={collapsed ? label : undefined}
            className={cn(
              "group flex h-9 items-center gap-2.5 rounded-md text-ui font-medium text-sidebar-foreground",
              "transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground",
              "data-[status=active]:bg-brand-subtle data-[status=active]:font-semibold data-[status=active]:text-brand-text",
              collapsed ? "w-9 justify-center self-center" : "px-2.5",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {!collapsed && label}
          </Link>
        );
        return collapsed ? (
          <Tooltip key={to} content={label} side="right">
            {link}
          </Tooltip>
        ) : (
          link
        );
      })}
    </nav>
  );
}
