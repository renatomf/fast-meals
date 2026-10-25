import { Outlet } from "@tanstack/react-router";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Logo, LogoMark } from "@/design-system/brand/logo";
import { ThemeToggle } from "@/design-system/components/theme-toggle";
import { Badge } from "@/design-system/ui/badge";
import { Button } from "@/design-system/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/design-system/ui/sheet";
import { Tooltip } from "@/design-system/ui/tooltip";
import { useRealtime } from "@/hooks/use-realtime";
import { cn } from "@/utils/cn";
import { useSidebarCollapsed } from "../hooks/use-sidebar-collapsed";
import { AppNavigation } from "./app-navigation";
import { CommandPalette } from "./command-palette";
import { LiveIndicator } from "./live-indicator";

// Barra lateral clara, recolhível até ficar só com os ícones; cabeçalho com a busca e o
// usuário (padrão Stripe). Abaixo de 1024px a barra vira um menu que abre pela esquerda, e o
// usuário, o tema e o "Sair" vão para dentro dele: no celular o cabeçalho não comporta tudo.
export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  const realtime = useRealtime(user !== null);

  // Ctrl+K no Windows e no Linux, ⌘K no Mac, de qualquer lugar do painel. No celular, sem
  // teclado físico, a busca abre pelo botão do cabeçalho.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const roleBadge = user && (
    <Badge tone={user.role === "admin" ? "brand" : "neutral"}>
      {user.role === "admin" ? "Admin" : "Somente leitura"}
    </Badge>
  );

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col gap-6 border-r bg-sidebar py-4 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex",
          collapsed ? "w-16 items-center px-2" : "w-60 px-3",
        )}
      >
        <div
          className={cn(
            "flex items-center",
            collapsed ? "flex-col gap-3" : "justify-between pr-0.5 pl-2.5",
          )}
        >
          {collapsed ? <LogoMark className="size-6" /> : <Logo size="sm" />}
          <Tooltip content={collapsed ? "Expandir menu" : "Recolher menu"} side="right">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggle}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              aria-expanded={!collapsed}
              className="text-muted-foreground"
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </Tooltip>
        </div>
        <AppNavigation collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur sm:gap-3 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </Button>
          <Logo size="sm" className="lg:hidden" />

          {/* Celular: só o ícone. Desktop: campo com o atalho à vista. */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto sm:hidden"
            onClick={() => setPaletteOpen(true)}
            aria-label="Buscar"
          >
            <Search />
          </Button>
          <Button
            variant="secondary"
            className="hidden w-56 justify-start gap-2 text-muted-foreground sm:ml-auto sm:flex lg:ml-0"
            onClick={() => setPaletteOpen(true)}
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search />
            Buscar…
            <kbd className="ml-auto rounded border bg-muted px-1.5 font-sans text-xs">Ctrl K</kbd>
          </Button>

          <div className="flex items-center gap-2 lg:ml-auto">
            <LiveIndicator status={realtime} />
            <div className="hidden items-center gap-2 lg:flex">
              <ThemeToggle />
              {user && (
                <div className="flex items-center gap-2 border-l pl-3">
                  <span className="text-ui font-medium">{user.email}</span>
                  {roleBadge}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void logout()}
                    aria-label="Sair"
                  >
                    <LogOut />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="gap-6 px-3 py-4">
          <SheetTitle className="px-2.5">
            <Logo size="sm" />
          </SheetTitle>
          <SheetDescription className="sr-only">Navegação do painel</SheetDescription>
          <AppNavigation onNavigate={() => setMenuOpen(false)} />

          {user && (
            <div className="mt-auto flex flex-col gap-3 border-t px-2.5 pt-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-ui font-medium">{user.email}</span>
                {roleBadge}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ui text-muted-foreground">Tema</span>
                <ThemeToggle />
              </div>
              <Button
                variant="secondary"
                className="justify-start"
                onClick={() => {
                  setMenuOpen(false);
                  void logout();
                }}
              >
                <LogOut /> Sair
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
