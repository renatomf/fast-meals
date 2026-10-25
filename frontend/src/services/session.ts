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

// keepalive: um F5 no meio da renovação não cancela a requisição. Sem isso, o servidor
// já rotacionou o token, mas o navegador nunca grava o cookie novo; no reload, o token
// antigo é recusado e o usuário cai no login (achado pelo teste E2E).
async function requestRefresh(): Promise<Response> {
  return fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

// Duas abas renovando juntas apresentam o mesmo cookie; a segunda recebe 401 dentro da
// janela de tolerância do backend e, logo depois, já tem o cookie novo gravado pela
// primeira. Uma segunda tentativa resolve sem derrubar a sessão.
const SECOND_ATTEMPT_DELAY_MS = 300;
const MAX_RATE_LIMIT_WAIT_MS = 10_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A renovação não foi possível agora (limite de requisições, servidor fora), mas a sessão
// pode continuar válida: quem chama não deve tratar isso como logout.
export class SessionUnavailableError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Não foi possível renovar a sessão agora. Tente novamente em instantes.");
    this.name = "SessionUnavailableError";
    this.status = status;
  }
}

// Só um 401 encerra a sessão. Um 429 espera o Retry-After e tenta de novo; qualquer outra
// falha vira SessionUnavailableError. Antes, um F5 com o limite de requisições estourado
// deslogava o usuário com a sessão válida (achado pelo teste E2E).
async function refreshOnce(): Promise<RestoredSession | null> {
  let response = await requestRefresh();
  if (response.status === 401) {
    await wait(SECOND_ATTEMPT_DELAY_MS);
    response = await requestRefresh();
  }
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after"));
    await wait(
      Math.min(
        Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000,
        MAX_RATE_LIMIT_WAIT_MS,
      ),
    );
    response = await requestRefresh();
  }
  if (response.status === 401) return null;
  if (!response.ok) throw new SessionUnavailableError(response.status);
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
