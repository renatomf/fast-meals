import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Front e API na mesma origem (aqui pelo proxy, no Docker pelo nginx): o cookie
  // httpOnly do refresh token funciona com SameSite=Strict e não há CORS no navegador.
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/ws": { target: apiTarget, ws: true },
    },
  },
});
