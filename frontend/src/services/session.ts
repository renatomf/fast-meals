import type { AuthUser, RefreshResponse } from "@fastmeals/contracts";

// O access token vive só aqui, em memória: some no F5 e nunca vai para o localStorage,
// onde um XSS o leria. A sessão volta pelo cookie httpOnly do refresh (ADR 0004).
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export type RestoredSession = { accessToken: string; user: AuthUser };

async function requestRefresh(): Promise<Response> {
  return fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

// Duas abas renovando juntas apresentam o mesmo cookie; a segunda recebe 401 dentro da
// janela de tolerância do backend e, logo depois, já tem o cookie novo gravado pela
// primeira. Uma segunda tentativa resolve sem derrubar a sessão.
const SECOND_ATTEMPT_DELAY_MS = 300;

async function refreshOnce(): Promise<RestoredSession | null> {
  let response = await requestRefresh();
  if (response.status === 401) {
    await new Promise((resolve) => setTimeout(resolve, SECOND_ATTEMPT_DELAY_MS));
    response = await requestRefresh();
  }
  if (!response.ok) return null;
  const body = (await response.json()) as RefreshResponse;
  setAccessToken(body.accessToken);
  return { accessToken: body.accessToken, user: body.user };
}

let inFlight: Promise<RestoredSession | null> | null = null;

// Single-flight: cinco requisições que recebem 401 ao mesmo tempo esperam o mesmo
// refresh. Cinco refreshes paralelos com o mesmo token seriam tratados pelo backend como
// reuso, e a sessão inteira seria revogada.
export function refreshSession(): Promise<RestoredSession | null> {
  inFlight ??= refreshOnce().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

const expiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

export function notifySessionExpired(): void {
  setAccessToken(null);
  for (const listener of expiredListeners) listener();
}
