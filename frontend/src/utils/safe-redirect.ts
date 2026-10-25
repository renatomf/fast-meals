// O destino pós-login vem da URL (?redirect=...), então qualquer um monta o link. Só
// caminhos internos passam: "https://outro-site" ou "//outro-site" levariam o usuário para
// fora logo depois de digitar a senha (open redirect).
export function safeRedirect(target: string | undefined, fallback = "/"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }
  return target;
}
