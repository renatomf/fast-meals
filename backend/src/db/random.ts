// mulberry32: a mesma semente produz a mesma sequência em qualquer máquina. É o que faz
// o seed gerar sempre os mesmos pedidos, valores e horários, e o dashboard bater com o README.
export function createRandom(seed: number) {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  function int(min: number, max: number): number {
    return min + Math.floor(next() * (max - min + 1));
  }

  function pick<T>(items: readonly T[]): T {
    const item = items[int(0, items.length - 1)];
    if (item === undefined) throw new Error("pick() needs a non-empty list");
    return item;
  }

  return { next, int, pick };
}

export type Random = ReturnType<typeof createRandom>;
