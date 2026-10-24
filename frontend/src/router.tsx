import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { z } from "zod";
import type { AuthState } from "@/context/auth-context";
import { LoginPage } from "@/features/auth";
import { dashboardSearchSchema, loadDashboardPage } from "@/features/dashboard";
import { loadOrdersPage, ordersSearchSchema } from "@/features/orders";
import { AppShell, ComingSoonPage, NotFoundPage, RouteError } from "@/features/shell";
import { safeRedirect } from "@/utils/safe-redirect";

export type RouterContext = { auth: AuthState; queryClient: QueryClient };

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: z.object({
    redirect: z.string().optional(),
    expired: z.boolean().optional(),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.status === "authenticated") {
      throw redirect({ href: safeRedirect(search.redirect) });
    }
  },
  component: LoginPage,
});

// Rotas autenticadas. Sem sessão, vai para o login lembrando de onde veio; com a sessão
// expirada, o login explica por quê.
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: ({ context, location }) => {
    if (context.auth.status !== "authenticated") {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
          expired: context.auth.status === "anonymous" && context.auth.expired ? true : undefined,
        },
      });
    }
  },
  component: AppShell,
  errorComponent: RouteError,
  notFoundComponent: NotFoundPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  validateSearch: dashboardSearchSchema,
  component: lazyRouteComponent(loadDashboardPage, "DashboardPage"),
});

const ordersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/orders",
  validateSearch: ordersSearchSchema,
  component: lazyRouteComponent(loadOrdersPage, "OrdersPage"),
});

// Genérico para manter o path literal: assim o <Link to="/dispatch"> continua tipado.
const comingSoon = <TPath extends string>(path: TPath, title: string) =>
  createRoute({
    getParentRoute: () => appRoute,
    path,
    component: () => <ComingSoonPage title={title} />,
  });

// Endereço desconhecido também passa pelo login e mostra o 404 dentro do shell, com a navegação.
const notFoundRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "$",
  component: NotFoundPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    ordersRoute,
    comingSoon("/dispatch", "Despacho"),
    comingSoon("/products", "Cardápio"),
    comingSoon("/delivery-persons", "Entregadores"),
    comingSoon("/reports", "Relatórios"),
    notFoundRoute,
  ]),
]);

export function createAppRouter(context: RouterContext) {
  return createRouter({
    routeTree,
    context,
    defaultPreload: "intent",
    // O TanStack Query já guarda os dados; o loader do router não precisa de cache próprio.
    defaultPreloadStaleTime: 0,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
