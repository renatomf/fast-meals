import { useCallback, useState } from "react";

const STORAGE_KEY = "fastmeals.sidebar-collapsed";

// localStorage pode lançar exceção (modo privado, armazenamento bloqueado): aí a preferência
// só não é lembrada entre visitas, como no tema.
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Sem persistência; a escolha vale até recarregar.
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
