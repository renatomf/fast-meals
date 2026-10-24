import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// Sem sessão por padrão: cada teste declara o que a API responde com server.use(...).
// Uma requisição sem handler falha o teste (onUnhandledFrame: "error" no setup).
export const server = setupServer(
  http.post("/api/auth/refresh", () =>
    HttpResponse.json(
      { error: { code: "INVALID_REFRESH_TOKEN", message: "Sessão inválida", details: [] } },
      { status: 401 },
    ),
  ),
);
