import "@fontsource-variable/inter";
import "./styles/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, initialTheme } from "./utils/theme";

// Aplicado antes do primeiro render para não piscar o tema errado.
applyTheme(initialTheme());

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado em index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
