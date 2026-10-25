import {
  REALTIME_CLOSE,
  realtimeClientMessageSchema,
  type RealtimeServerMessage,
} from "@fastmeals/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { WebSocket } from "ws";
import type { AuthService } from "../auth/auth.service.ts";
import type { ChangeFeed } from "./change-feed.ts";

type RealtimeOptions = {
  changeFeed: ChangeFeed;
  verifyAccessToken: AuthService["verifyAccessToken"];
  allowedOrigin: string;
  authTimeoutMs?: number;
  heartbeatMs?: number;
};

function send(socket: WebSocket, message: RealtimeServerMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

// Um canal só de leitura: o servidor avisa que algo mudou e o painel recarrega pela API.
// Admin e viewer recebem os mesmos avisos, porque os dois podem ler tudo.
export const realtimeRoutes: FastifyPluginAsync<RealtimeOptions> = async (
  app,
  { changeFeed, verifyAccessToken, allowedOrigin, authTimeoutMs = 5_000, heartbeatMs = 30_000 },
) => {
  app.get("/ws", { websocket: true, schema: { hide: true } }, (socket, request) => {
    // O token não vai junto do handshake, então outro site não teria o que mandar; conferir
    // a origem fecha a porta mesmo assim, sem custo.
    const origin = request.headers.origin;
    if (origin && origin !== allowedOrigin) {
      socket.close(REALTIME_CLOSE.forbiddenOrigin, "origin not allowed");
      return;
    }

    let token: string | null = null;
    let unsubscribe: (() => void) | null = null;
    let alive = true;

    const authTimer = setTimeout(() => {
      if (!token) socket.close(REALTIME_CLOSE.unauthorized, "authentication required");
    }, authTimeoutMs);

    // Ping para derrubar conexões mortas e reconferir o token: quando ele vence, o cliente
    // reconecta com um novo, renovado pela API.
    const heartbeat = setInterval(() => {
      if (!alive) {
        socket.terminate();
        return;
      }
      alive = false;
      socket.ping();
      if (token) {
        try {
          verifyAccessToken(token);
        } catch {
          socket.close(REALTIME_CLOSE.tokenExpired, "token expired");
        }
      }
    }, heartbeatMs);

    socket.on("pong", () => {
      alive = true;
    });

    socket.on("message", (raw) => {
      const parsed = realtimeClientMessageSchema.safeParse(
        (() => {
          try {
            return JSON.parse(String(raw));
          } catch {
            return null;
          }
        })(),
      );
      if (!parsed.success) {
        socket.close(REALTIME_CLOSE.unauthorized, "invalid message");
        return;
      }
      try {
        verifyAccessToken(parsed.data.token);
      } catch {
        socket.close(REALTIME_CLOSE.unauthorized, "invalid token");
        return;
      }
      token = parsed.data.token;
      clearTimeout(authTimer);
      if (!unsubscribe) {
        unsubscribe = changeFeed.subscribe((event) => send(socket, { type: "change", event }));
        send(socket, { type: "ready" });
      }
    });

    socket.on("close", () => {
      clearTimeout(authTimer);
      clearInterval(heartbeat);
      unsubscribe?.();
    });
  });
};
