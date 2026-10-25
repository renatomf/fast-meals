import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { apiRequest } from "@/services/api-client";
import { onSessionExpired, setAccessToken } from "@/services/session";
import { adminUser, sessionFor } from "./support/fixtures";
import { server } from "./support/server";

function SessionStatus() {
  const { state } = useAuth();
  return <p>{state.status}</p>;
}

afterEach(() => setAccessToken(null));

describe("session refresh", () => {
  it("waits for Retry-After instead of logging out when the API is rate limited", async () => {
    let calls = 0;
    server.use(
      http.post("/api/auth/refresh", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              {
                error: { code: "RATE_LIMIT_EXCEEDED", message: "Muitas requisições", details: [] },
              },
              { status: 429, headers: { "retry-after": "1" } },
            )
          : HttpResponse.json(sessionFor(adminUser));
      }),
    );

    render(
      <AuthProvider>
        <SessionStatus />
      </AuthProvider>,
    );

    expect(await screen.findByText("authenticated", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it("keeps the session when the refresh fails for a reason other than 401", async () => {
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);
    setAccessToken("expired-access-token");
    server.use(
      http.get("/api/orders", () =>
        HttpResponse.json(
          { error: { code: "TOKEN_EXPIRED", message: "Token de acesso expirado", details: [] } },
          { status: 401 },
        ),
      ),
      http.post("/api/auth/refresh", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Indisponível", details: [] } },
          { status: 503 },
        ),
      ),
    );

    await expect(apiRequest("/orders")).rejects.toMatchObject({ status: 401 });

    expect(expired).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("ends the session when the refresh token is refused", async () => {
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);
    setAccessToken("expired-access-token");
    server.use(
      http.get("/api/orders", () =>
        HttpResponse.json(
          { error: { code: "TOKEN_EXPIRED", message: "Token de acesso expirado", details: [] } },
          { status: 401 },
        ),
      ),
    );

    await expect(apiRequest("/orders")).rejects.toMatchObject({ status: 401 });

    expect(expired).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
