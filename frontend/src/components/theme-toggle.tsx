import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { applyTheme, initialTheme, storeTheme, type Theme } from "@/utils/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    applyTheme(next);
    storeTheme(next);
    setTheme(next);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={next === "dark" ? "Ativar tema escuro" : "Ativar tema claro"}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
