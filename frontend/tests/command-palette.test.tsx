import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, ws } from "msw";
import { describe, expect, it } from "vitest";
import { App } from "@/App";
import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { adminUser, listOf, sessionFor } from "./support/fixtures";
import { server } from "./support/server";

// App inteiro já autenticado (a sessão volta pelo refresh), só com a rede simulada.
function renderLoggedIn(path: string) {
  server.use(
    http.post("/api/auth/refresh", () => HttpResponse.json(sessionFor(adminUser))),
    http.get("/api/orders", () => HttpResponse.json(listOf([]))),
    http.get("/api/products", () =>
      HttpResponse.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
    ),
    // O shell abre o canal de tempo real; aqui ele só aceita a conexão.
    ws.link("ws://localhost:3000/ws").addEventListener("connection", () => {}),
  );
  window.history.replaceState(null, "", path);
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

describe("command palette", () => {
  it("opens with Ctrl+K, filters as you type and navigates with the keyboard", async () => {
    const user = userEvent.setup();
    renderLoggedIn("/orders");
    expect(await screen.findByRole("heading", { name: "Pedidos" })).toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");
    const input = await screen.findByRole("combobox", { name: "Buscar telas, filas ou produtos" });
    expect(input).toHaveFocus();

    // Sem acento e em minúsculas também acha.
    await user.type(input, "cardapio");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("heading", { name: "Cardápio" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/products");
    expect(
      screen.queryByRole("combobox", { name: "Buscar telas, filas ou produtos" }),
    ).not.toBeInTheDocument();
  });

  it("moves the active option with the arrows and opens a queue", async () => {
    const user = userEvent.setup();
    renderLoggedIn("/orders");
    await screen.findByRole("heading", { name: "Pedidos" });

    await user.keyboard("{Control>}k{/Control}");
    const input = await screen.findByRole("combobox");
    await user.type(input, "pedidos");
    // "Pedidos", "Pedidos pendentes", "Pedidos prontos para despacho": desce duas vezes.
    await user.keyboard("{ArrowDown}{ArrowDown}");
    const active = screen.getByRole("option", { selected: true });
    expect(active).toHaveTextContent("Pedidos prontos para despacho");
    expect(input).toHaveAttribute("aria-activedescendant", active.id);
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("tab", { name: "Pronto" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(window.location.search).toBe("?status=ready");
  });
});
