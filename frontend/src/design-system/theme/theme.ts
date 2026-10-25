export type Theme = "light" | "dark";

const STORAGE_KEY = "fastmeals.theme";

// localStorage pode lançar exceção (modo privado, armazenamento bloqueado);
// nesses casos o tema só não é lembrado entre visitas.
export function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sem persistência; o tema continua aplicado nesta sessão.
  }
}

export function initialTheme(): Theme {
  return (
    readStoredTheme() ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
