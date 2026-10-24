import type { AuthUser, Order, OrderStatus } from "@fastmeals/contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "@/context/auth-context";
import { TooltipProvider } from "@/design-system/ui/tooltip";
import { OrderActions } from "@/features/orders/components/order-actions";
import { StatusBadge } from "@/features/orders/components/status-badge";
import { createQueryClient } from "@/services/query-client";
import { adminUser, buildOrder, sessionFor, viewerUser } from "./support/fixtures";
import { server } from "./support/server";

describe("StatusBadge", () => {
  it.each([
    ["pending", "Pendente"],
    ["preparing", "Em preparo"],
    ["ready", "Pronto"],
    ["delivering", "Em entrega"],
    ["delivered", "Entregue"],
    ["cancelled", "Cancelado"],
  ] satisfies [OrderStatus, string][])("labels %s as %s with its own color", (status, label) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(label)).toHaveClass(`text-status-${status}`);
  });
});

// A sessão volta pelo refresh, como num F5: o AuthProvider real decide o perfil.
function renderActions(order: Order, user: AuthUser) {
  server.use(http.post("/api/auth/refresh", () => HttpResponse.json(sessionFor(user))));
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthProvider>
        <TooltipProvider>
          <OrderActions order={order} />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function captureStatusChanges() {
  const requests: { id: string | readonly string[] | undefined; body: unknown }[] = [];
  server.use(
    http.patch("/api/orders/:id/status", async ({ params, request }) => {
      const body = (await request.json()) as { status: OrderStatus };
      requests.push({ id: params.id, body });
      return HttpResponse.json(buildOrder({ status: body.status }));
    }),
  );
  return requests;
}

describe("OrderActions", () => {
  it("offers only the transitions the backend accepts and sends the chosen one", async () => {
    const requests = captureStatusChanges();
    const order = buildOrder({ status: "pending" });
    const user = userEvent.setup();
    renderActions(order, adminUser);

    // Enquanto a sessão volta o botão está desabilitado (e é outro elemento): busca de novo.
    const start = await waitFor(() => {
      const button = screen.getByRole("button", { name: "Iniciar preparo" });
      expect(button).toBeEnabled();
      return button;
    });
    expect(screen.getByRole("button", { name: "Cancelar pedido" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como pronto" })).not.toBeInTheDocument();

    await user.click(start);

    await waitFor(() =>
      expect(requests).toEqual([{ id: order.id, body: { status: "preparing" } }]),
    );
  });

  it("asks for confirmation before cancelling", async () => {
    const requests = captureStatusChanges();
    const user = userEvent.setup();
    renderActions(buildOrder({ status: "ready", deliveryPerson: null }), adminUser);

    const cancel = await waitFor(() => {
      const button = screen.getByRole("button", { name: "Cancelar pedido" });
      expect(button).toBeEnabled();
      return button;
    });
    await user.click(cancel);

    const dialog = await screen.findByRole("alertdialog");
    expect(requests).toHaveLength(0);
    await user.click(within(dialog).getByRole("button", { name: "Cancelar pedido" }));

    await waitFor(() =>
      expect(requests.map((request) => request.body)).toEqual([{ status: "cancelled" }]),
    );
  });

  it("blocks leaving for delivery while no delivery person is assigned", async () => {
    renderActions(buildOrder({ status: "ready", deliveryPerson: null }), adminUser);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancelar pedido" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "Saiu para entrega" })).toBeDisabled();
  });

  it("shows the actions to a viewer, but disabled", async () => {
    const requests = captureStatusChanges();
    const user = userEvent.setup();
    renderActions(buildOrder({ status: "pending" }), viewerUser);

    // Espera a sessão do viewer voltar; antes disso ninguém pode nada.
    await waitFor(() => expect(requests).toHaveLength(0));
    const start = await screen.findByRole("button", { name: "Iniciar preparo" });
    expect(start).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar pedido" })).toBeDisabled();

    await user.click(start);
    expect(requests).toHaveLength(0);
  });
});
