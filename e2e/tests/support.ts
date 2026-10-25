import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const accounts = {
  admin: { email: "admin@fastmeals.com", password: "Admin@123" },
  viewer: { email: "viewer@fastmeals.com", password: "Viewer@123" },
} as const;

export async function signIn(page: Page, role: keyof typeof accounts, path = "/") {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Entrar no painel" })).toBeVisible();
  await page.getByLabel("Email").fill(accounts[role].email);
  await page.getByLabel("Senha").fill(accounts[role].password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  // A busca está no cabeçalho em qualquer largura; o "Sair" no celular fica dentro do menu.
  await expect(page.getByRole("button", { name: /^Buscar/ }).first()).toBeVisible();
}

// Nome único por execução: os testes criam os próprios pedidos e não dependem do seed.
export function uniqueCustomer(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}

// Só violações sérias e críticas reprovam; as regras são as de WCAG 2.1 A e AA.
// O logotipo fica de fora: a WCAG isenta logotipos da exigência de contraste (critério
// 1.4.3), e o verde da marca sobre branco não passaria. Todo o resto do texto é verificado.
export async function expectNoSeriousA11yViolations(page: Page) {
  // No meio de um esmaecido de entrada o texto ainda está translúcido e o contraste medido
  // sai menor que o real: espera as animações finitas terminarem. As infinitas (o
  // tracejado das rotas no mapa) não terminam nunca e ficam de fora.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY,
      ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("[data-logo]")
    .analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      rule: violation.id,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(" ")).slice(0, 5),
    }));
  expect(serious).toEqual([]);
}

// Primeira linha com dados de verdade (todas têm um telefone). Enquanto a lista carrega, a
// tabela mostra linhas de esqueleto; com a latência de um deploy, um nth(1) pegaria uma
// delas e o clique ou o foco se perderiam quando os dados chegassem.
export function firstDataRow(page: Page) {
  return page
    .getByRole("row")
    .filter({ hasText: /\(\d{2}\) \d/ })
    .first();
}
