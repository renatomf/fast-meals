import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { applyTheme, initialTheme, storeTheme, type Theme } from "./theme.ts";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// O tema já foi aplicado no main.tsx antes do primeiro render (sem piscar); aqui ele vira
// estado, para quem desenha cores fora do CSS (gráficos, mapa) acompanhar a troca.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    storeTheme(next);
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    [theme, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  return context;
}
