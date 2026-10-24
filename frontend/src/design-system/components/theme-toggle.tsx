import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/design-system/theme/theme-provider";
import { Button } from "@/design-system/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
