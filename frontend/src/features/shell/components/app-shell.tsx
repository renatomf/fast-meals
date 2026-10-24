import { Outlet } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Logo } from "@/design-system/brand/logo";
import { ThemeToggle } from "@/design-system/components/theme-toggle";
import { Badge } from "@/design-system/ui/badge";
import { Button } from "@/design-system/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/design-system/ui/sheet";
import { AppNavigation } from "./app-navigation";

// Barra lateral estreita e clara, cabeçalho com o usuário à direita (padrão Stripe).
// Abaixo de 1024px a barra vira um menu que abre pela esquerda.
export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar px-3 py-4 lg:flex">
        <div className="px-2.5">
          <Logo size="sm" />
        </div>
        <AppNavigation />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </Button>
          <Logo size="sm" className="lg:hidden" />

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-2 border-l pl-3">
                <div className="hidden flex-col items-end leading-tight sm:flex">
                  <span className="text-ui font-medium">{user.email}</span>
                </div>
                <Badge tone={user.role === "admin" ? "brand" : "neutral"}>
                  {user.role === "admin" ? "Admin" : "Somente leitura"}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Sair">
                  <LogOut />
                </Button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="gap-6 px-3 py-4">
          <SheetTitle className="px-2.5">
            <Logo size="sm" />
          </SheetTitle>
          <SheetDescription className="sr-only">Navegação do painel</SheetDescription>
          <AppNavigation onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
