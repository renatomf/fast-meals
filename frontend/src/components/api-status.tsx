import type { HealthResponse } from "@fastmeals/contracts";
import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

type Status = "checking" | "up" | "degraded" | "offline";

const labels: Record<Status, string> = {
  checking: "Verificando API…",
  up: "API e banco operando",
  degraded: "API sem acesso ao banco",
  offline: "API indisponível",
};

// Provisório: some no dia 5, quando o TanStack Query entrar.
export function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((response) => response.json() as Promise<HealthResponse>)
      .then((health) => setStatus(health.database === "up" ? "up" : "degraded"))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("health check failed", error);
          setStatus("offline");
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground"
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "up" && "bg-success",
          status === "degraded" && "bg-warning",
          status === "offline" && "bg-destructive",
          status === "checking" && "bg-muted-foreground animate-pulse",
        )}
      />
      {labels[status]}
    </span>
  );
}
