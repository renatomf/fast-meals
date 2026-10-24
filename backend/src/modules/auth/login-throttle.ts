// Falhas de login por email. O rate limit por IP não segura um ataque distribuído contra
// uma conta só; este conta as falhas daquele email, venham de onde vierem. Só falhas
// contam, e acertar a senha zera o contador.
//
// Em memória, como o rate limit: vale por instância. Com várias réplicas, o contador
// iria para o Redis (ADR 0006).

type Attempts = { failures: number; windowEndsAt: number };

type LoginThrottleOptions = {
  maxFailures: number;
  windowMs: number;
  now?: () => number;
};

// Emails que nunca voltam (um ataque tentando endereços aleatórios) ficariam no mapa
// para sempre; acima deste tamanho, as janelas vencidas são varridas.
const SWEEP_THRESHOLD = 10_000;

export function createLoginThrottle({
  maxFailures,
  windowMs,
  now = Date.now,
}: LoginThrottleOptions) {
  const attempts = new Map<string, Attempts>();

  function liveAttempts(email: string): Attempts | undefined {
    const entry = attempts.get(email);
    if (entry && entry.windowEndsAt <= now()) {
      attempts.delete(email);
      return undefined;
    }
    return entry;
  }

  function sweepExpired() {
    const moment = now();
    for (const [email, entry] of attempts) {
      if (entry.windowEndsAt <= moment) attempts.delete(email);
    }
  }

  return {
    // Milissegundos até o email poder tentar de novo; 0 quando não está bloqueado.
    blockedForMs(email: string): number {
      const entry = liveAttempts(email);
      return entry && entry.failures >= maxFailures ? entry.windowEndsAt - now() : 0;
    },

    // Devolve true na falha que inicia o bloqueio, para o chamador registrar o evento uma vez.
    recordFailure(email: string): boolean {
      if (attempts.size >= SWEEP_THRESHOLD) sweepExpired();
      const entry = liveAttempts(email) ?? { failures: 0, windowEndsAt: now() + windowMs };
      entry.failures += 1;
      attempts.set(email, entry);
      return entry.failures === maxFailures;
    },

    reset(email: string): void {
      attempts.delete(email);
    },

    trackedEmails(): number {
      return attempts.size;
    },
  };
}

export type LoginThrottle = ReturnType<typeof createLoginThrottle>;
