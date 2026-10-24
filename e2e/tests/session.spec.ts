import { expect, test } from "@playwright/test";
import { signIn } from "./support.ts";

test("an anonymous visitor logs in, keeps the session on reload and logs out", async ({ page }) => {
  // Pede uma página protegida: vai para o login e volta para ela, com o filtro.
  await signIn(page, "admin", "/orders?status=ready");
  await expect(page).toHaveURL(/\/orders\?status=ready$/);
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Pronto" })).toHaveAttribute("aria-selected", "true");

  // O access token vive só em memória; o F5 recupera a sessão pelo cookie httpOnly.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  await expect(page.getByText("admin@fastmeals.com")).toBeVisible();
  const cookies = await page.context().cookies();
  const refresh = cookies.find((cookie) => cookie.path === "/api/auth");
  expect(refresh?.httpOnly).toBe(true);
  expect(refresh?.sameSite).toBe("Strict");

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("heading", { name: "Entrar no painel" })).toBeVisible();

  // Depois de sair, nem o F5 nem a URL direta devolvem a sessão.
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Entrar no painel" })).toBeVisible();
});

test("wrong credentials show an error and keep the visitor on login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@fastmeals.com");
  await page.getByLabel("Senha").fill("senha-errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page.getByRole("alert")).toHaveText("Email ou senha inválidos.");
  await expect(page).toHaveURL(/\/login$/);
});

test("unknown routes show the not found page inside the app", async ({ page }) => {
  await signIn(page, "viewer", "/rota-que-nao-existe");
  await expect(page.getByText(/não encontrada/i)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
});
