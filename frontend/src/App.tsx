import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { LogoMark } from "@/design-system/brand/logo";
import { useTheme } from "@/design-system/theme/theme-provider";
import { TooltipProvider } from "@/design-system/ui/tooltip";
import { createQueryClient } from "@/services/query-client";
import { createAppRouter } from "./router";

const queryClient = createQueryClient();

function SplashScreen() {
  return (
    <div
      className="grid min-h-svh place-items-center"
      role="status"
      aria-label="Carregando o painel"
    >
      <LogoMark className="size-10 animate-pulse" />
    </div>
  );
}

// O roteador é criado uma vez; quando a sessão muda (login, logout, expiração), o contexto
// é atualizado e as rotas reavaliam o beforeLoad, que redireciona quem não pode estar ali.
function AppRouter() {
  const { state } = useAuth();
  const [router] = useState(() => createAppRouter({ auth: state, queryClient }));

  useEffect(() => {
    router.update({ ...router.options, context: { auth: state, queryClient } });
    void router.invalidate();
  }, [router, state]);

  if (state.status === "loading") return <SplashScreen />;
  return <RouterProvider router={router} context={{ auth: state, queryClient }} />;
}

export function App() {
  const { theme } = useTheme();
  // Ao sair ou quando a sessão expira, nada carregado pelo usuário anterior fica em cache.
  const clearCache = useCallback(() => queryClient.clear(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider onSignOut={clearCache}>
        <TooltipProvider>
          <AppRouter />
        </TooltipProvider>
      </AuthProvider>
      <Toaster theme={theme} position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
