import { REALTIME_CLOSE, type ChangeEvent } from "@fastmeals/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse, ws } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRealtime } from "@/hooks/use-realtime";
import { setAccessToken } from "@/services/session";
import { adminUser, sessionFor } from "./support/fixtures";
import { server } from "./support/server";

const socket = ws.link("ws://localhost:3000/ws");

const orderChanged: ChangeEvent = {
  entity: "orders",
  op: "update",
  id: "0190a0b0-0000-7000-8000-0000000000aa",
  status: "ready",
};

function setup() {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useRealtime(true), { wrapper });
  const invalidatedKeys = () =>
    invalidate.mock.calls.map(([filters]) => filters?.queryKey).filter(Boolean);
  return { hook, invalidatedKeys };
}

afterEach(() => setAccessToken(null));

describe("useRealtime", () => {
  it("authenticates with the access token and goes live on ready", async () => {
    setAccessToken("access-admin");
    const received: unknown[] = [];
    server.use(
      socket.addEventListener("connection", ({ client }) => {
        client.addEventListener("message", (event) => {
          received.push(JSON.parse(String(event.data)));
          client.send(JSON.stringify({ type: "ready" }));
        });
      }),
    );

    const { hook } = setup();

    await waitFor(() => expect(hook.result.current).toBe("live"));
    expect(received).toEqual([{ type: "auth", token: "access-admin" }]);
    hook.unmount();
  });

  it("refreshes the caches affected by a change, once per batch", async () => {
    setAccessToken("access-admin");
    let push: (event: ChangeEvent) => void = () => {};
    server.use(
      socket.addEventListener("connection", ({ client }) => {
        push = (event) => client.send(JSON.stringify({ type: "change", event }));
        client.addEventListener("message", () => client.send(JSON.stringify({ type: "ready" })));
      }),
    );
    const { hook, invalidatedKeys } = setup();
    await waitFor(() => expect(hook.result.current).toBe("live"));

    act(() => {
      push(orderChanged);
      push({ ...orderChanged, status: "delivering" });
    });

    await waitFor(() =>
      expect(invalidatedKeys()).toEqual([["orders"], ["reports"], ["delivery-persons"]]),
    );

    // O lote seguinte recarrega só o que mudou nele.
    act(() => push({ entity: "products", op: "update", id: orderChanged.id, status: null }));

    await waitFor(() =>
      expect(invalidatedKeys()).toEqual([
        ["orders"],
        ["reports"],
        ["delivery-persons"],
        ["products"],
        ["reports"],
      ]),
    );
    hook.unmount();
  });

  it("renews the token and reconnects when the server says it expired", async () => {
    setAccessToken("old-access");
    const tokens: string[] = [];
    server.use(
      http.post("/api/auth/refresh", () => HttpResponse.json(sessionFor(adminUser))),
      socket.addEventListener("connection", ({ client }) => {
        client.addEventListener("message", (event) => {
          const { token } = JSON.parse(String(event.data)) as { token: string };
          tokens.push(token);
          if (token === "old-access") client.close(REALTIME_CLOSE.tokenExpired, "token expired");
          else client.send(JSON.stringify({ type: "ready" }));
        });
      }),
    );

    const { hook } = setup();

    await waitFor(() => expect(hook.result.current).toBe("live"), { timeout: 4_000 });
    expect(tokens).toEqual(["old-access", "access-admin"]);
    hook.unmount();
  });
});
