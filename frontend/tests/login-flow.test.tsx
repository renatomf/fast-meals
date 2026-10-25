import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/App";
import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { adminUser, buildOrder, listOf, sessionFor } from "./support/fixtures";
import { server } from "./support/server";

// O app inteiro, com roteador e provedores reais; só a rede é simulada (MSW).
function renderAppAt(path: string) {
  window.history.replaceState(null, "", path);
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

describe("login flow", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/orders", ({ request }) => {
        // Sem o token do login, a lista não sai: prova que o header é enviado.
        if (request.headers.get("authorization") !== "Bearer access-admin") {
          return HttpResponse.json(
            { error: { code: "UNAUTHORIZED", message: "Token ausente", details: [] } },
            { status: 401 },
          );
        }
        return HttpResponse.json(listOf([buildOrder()]));
      }),
    );
  });

  it("sends an anonymous visitor to login and back to the page they asked for", async () => {
    let submitted: unknown;
    server.use(
      http.post("/api/auth/login", async ({ request }) => {
        submitted = await request.json();
        return HttpResponse.json(sessionFor(adminUser));
      }),
    );
    const user = userEvent.setup();
    renderAppAt("/orders?status=pending");

    expect(await screen.findByRole("heading", { name: "Entrar no painel" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("redirect")).toBe(
      "/orders?status=pending",
    );

    await user.type(screen.getByLabelText("Email"), "Admin@FastMeals.com");
    await user.type(screen.getByLabelText("Senha"), "Admin@123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Pedidos" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/orders");
    expect((await screen.findAllByText("Ana Souza")).length).toBeGreaterThan(0);
    // O schema compartilhado normaliza o email antes de enviar.
    expect(submitted).toEqual({ email: "admin@fastmeals.com", password: "Admin@123" });
  });

  it("shows a friendly error and stays on login when the credentials are wrong", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { error: { code: "INVALID_CREDENTIALS", message: "Credenciais inválidas", details: [] } },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderAppAt("/login");

    await user.type(await screen.findByLabelText("Email"), "admin@fastmeals.com");
    await user.type(screen.getByLabelText("Senha"), "errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email ou senha inválidos.");
    expect(window.location.pathname).toBe("/login");
  });

  it("validates the form before calling the API", async () => {
    const user = userEvent.setup();
    renderAppAt("/login");

    await user.click(await screen.findByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe um email válido")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("ignores an external redirect target after login", async () => {
    server.use(http.post("/api/auth/login", () => HttpResponse.json(sessionFor(adminUser))));
    server.use(http.get("/api/reports/*", () => HttpResponse.json({}, { status: 503 })));
    const user = userEvent.setup();
    renderAppAt("/login?redirect=%2F%2Fevil.example%2Fphish");

    await user.click(await screen.findByRole("button", { name: "Entrar como admin" }));

    // O dashboard é carregado sob demanda, com o Recharts: na primeira transformação do
    // Vite, em paralelo com os outros arquivos, ele passa do segundo padrão do findBy.
    expect(
      await screen.findByRole("heading", { name: "Visão geral" }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(window.location.origin + window.location.pathname).toBe(`${window.location.origin}/`);
  }, 20_000);
});
