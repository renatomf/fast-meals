import "@fontsource-variable/inter";
import "./design-system/theme/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, initialTheme } from "./design-system/theme/theme";
import { ThemeProvider } from "./design-system/theme/theme-provider";

// Aplicado antes do primeiro render para não piscar o tema errado.
applyTheme(initialTheme());

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado em index.html");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
