import "@fontsource-variable/inter";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/app";
import { applyTheme, initialTheme } from "./shared/theme/theme";

// Aplicado antes do primeiro render para não piscar o tema errado.
applyTheme(initialTheme());

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado em index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
