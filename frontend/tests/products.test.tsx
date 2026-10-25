import type { Product } from "@fastmeals/contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system/ui/tooltip";
import { ProductFormSheet } from "@/features/products/components/product-form-sheet";
import { ProductsTable } from "@/features/products/components/products-table";
import { createQueryClient } from "@/services/query-client";
import { server } from "./support/server";

const product: Product = {
  id: "0190a0b0-0000-7000-8000-0000000000c1",
  name: "X-Burger",
  description: "Pão brioche, blend de 160 g e queijo prato",
  price: 29.9,
  category: "meal",
  imageUrl: null,
  isAvailable: true,
  preparationTime: 15,
  createdAt: "2026-10-24T12:00:00.000Z",
  updatedAt: "2026-10-24T12:00:00.000Z",
};

function withProviders(children: React.ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

describe("ProductFormSheet", () => {
  it("shows the shared schema errors and sends nothing while the form is invalid", async () => {
    const created = vi.fn();
    server.use(http.post("/api/products", () => created()));
    const user = userEvent.setup();
    render(withProviders(<ProductFormSheet product={null} onClose={() => {}} />));

    await user.type(screen.getByLabelText("Nome"), "X");
    await user.type(screen.getByLabelText("Preço (R$)"), "12.345");
    await user.type(screen.getByLabelText("URL da imagem (opcional)"), "ftp://imagem");
    await user.click(screen.getByRole("button", { name: "Cadastrar produto" }));

    expect(await screen.findByText("O nome deve ter entre 3 e 120 caracteres")).toBeVisible();
    expect(screen.getByText("A descrição deve ter entre 10 e 500 caracteres")).toBeVisible();
    expect(screen.getByText("O valor deve ter no máximo 2 casas decimais")).toBeVisible();
    expect(screen.getByText("A imagem deve ser uma URL http(s) válida")).toBeVisible();
    expect(screen.getByLabelText("Nome")).toHaveAttribute("aria-invalid", "true");
    expect(created).not.toHaveBeenCalled();
  });

  it("sends typed values and shows an error the API still refuses on its field", async () => {
    let body: unknown;
    server.use(
      http.post("/api/products", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Dados inválidos",
              details: [{ field: "name", message: "Já existe um produto com este nome" }],
            },
          },
          { status: 400 },
        );
      }),
    );
    const user = userEvent.setup();
    render(withProviders(<ProductFormSheet product={null} onClose={() => {}} />));

    await user.type(screen.getByLabelText("Nome"), "Suco de Uva");
    await user.type(screen.getByLabelText("Descrição"), "Suco de uva integral, 500 ml");
    await user.type(screen.getByLabelText("Preço (R$)"), "11.5");
    await user.selectOptions(screen.getByLabelText("Categoria"), "drink");
    await user.click(screen.getByRole("button", { name: "Cadastrar produto" }));

    expect(await screen.findByText("Já existe um produto com este nome")).toBeVisible();
    // Números como números, URL vazia como null, defaults do schema aplicados.
    expect(body).toEqual({
      name: "Suco de Uva",
      description: "Suco de uva integral, 500 ml",
      price: 11.5,
      category: "drink",
      imageUrl: null,
      isAvailable: true,
      preparationTime: 15,
    });
  });
});

describe("ProductsTable", () => {
  function renderTable(canWrite: boolean) {
    const handlers = { onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
    render(
      withProviders(
        <ProductsTable products={[product]} loading={false} canWrite={canWrite} {...handlers} />,
      ),
    );
    // A tabela do desktop; a lista do celular repete as mesmas ações.
    const table = screen.getByRole("table");
    return { table, ...handlers };
  }

  it("lets an admin toggle availability, edit and delete", async () => {
    const user = userEvent.setup();
    const { table, onToggle, onEdit, onDelete } = renderTable(true);

    await user.click(within(table).getByRole("switch", { name: "X-Burger disponível" }));
    await user.click(within(table).getByRole("button", { name: "Editar X-Burger" }));
    await user.click(within(table).getByRole("button", { name: "Excluir X-Burger" }));

    expect(onToggle).toHaveBeenCalledWith(product, false);
    expect(onEdit).toHaveBeenCalledWith(product);
    expect(onDelete).toHaveBeenCalledWith(product);
  });

  it("shows a viewer every action, disabled, with the reason", async () => {
    const user = userEvent.setup();
    const { table, onToggle } = renderTable(false);

    const toggle = within(table).getByRole("switch", { name: "X-Burger disponível" });
    expect(toggle).toBeDisabled();
    expect(within(table).getByRole("button", { name: "Editar X-Burger" })).toBeDisabled();
    expect(within(table).getByRole("button", { name: "Excluir X-Burger" })).toBeDisabled();

    await user.click(toggle);
    expect(onToggle).not.toHaveBeenCalled();

    await user.hover(toggle.parentElement as HTMLElement);
    await waitFor(() => expect(screen.getAllByText(/Somente leitura/).length).toBeGreaterThan(0));
  });
});
