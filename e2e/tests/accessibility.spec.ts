import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11yViolations, signIn } from "./support.ts";

const themes = ["light", "dark"] as const;

// O tema lembrado entre visitas é aplicado antes do primeiro render; trocar o valor e
// recarregar a página reproduz o que o usuário vê ao voltar com o outro tema.
async function useTheme(page: Page, theme: (typeof themes)[number]) {
  await page.evaluate((value) => localStorage.setItem("fastmeals.theme", value), theme);
  await page.reload();
}

test("login, dashboard and orders have no serious violations in both themes", async ({ page }) => {
  await page.goto("/login");
  for (const theme of themes) {
    await useTheme(page, theme);
    await expect(page.getByRole("heading", { name: "Entrar no painel" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  }

  // Um login só: depois dele, cada recarga recupera a sessão pelo cookie.
  await signIn(page, "admin", "/");
  for (const theme of themes) {
    await test.step(theme, async () => {
      await page.goto("/");
      await useTheme(page, theme);
      await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoSeriousA11yViolations(page);

      await page.getByRole("link", { name: "Pedidos" }).click();
      await expect(page.getByRole("row").nth(1)).toBeVisible();
      await expectNoSeriousA11yViolations(page);

      await page.getByRole("row").nth(1).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
  }
});

test("the main flow works with the keyboard alone", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").focus();
  await page.keyboard.type("viewer@fastmeals.com");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Viewer@123");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();

  const ordersLink = page.getByRole("link", { name: "Pedidos" });
  await ordersLink.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();

  // Abre um pedido pelo teclado e fecha com Esc; o foco volta para a página.
  await page.getByRole("row").nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
