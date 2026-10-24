import { greedy } from "../src/algorithms/greedy.ts";
import { haversineKm, type Coordinates } from "../src/algorithms/haversine.ts";
import { hungarian } from "../src/algorithms/hungarian.ts";
import { createRandom } from "../src/db/random.ts";

// npm run bench:assignment — tempo do Húngaro e do guloso em matrizes de distância reais,
// em duas geometrias com semente fixa:
// - espalhada: pontos aleatórios numa área de ~20 × 20 km em São Paulo, o caso comum;
// - em fila: pedidos numa linha norte–sul e entregadores numa leste–oeste, a cada ~11 m.
//   Custos tão regulares obrigam o Húngaro a percorrer caminhos aumentantes longos: é o
//   pior caso que encontrei, e o que define o limite de lote do endpoint.

const sizes: [orders: number, people: number, runs: number][] = [
  [50, 30, 50],
  [200, 200, 15],
  [500, 500, 5],
];

const random = createRandom(2_026);

const geometries: Record<
  string,
  (orders: number, people: number) => [Coordinates[], Coordinates[]]
> = {
  espalhada: (orders, people) => {
    const point = () => ({
      latitude: -23.56 + (random.next() - 0.5) * 0.18,
      longitude: -46.65 + (random.next() - 0.5) * 0.18,
    });
    return [Array.from({ length: orders }, point), Array.from({ length: people }, point)];
  },
  "em fila": (orders, people) => [
    Array.from({ length: orders }, (_, index) => ({
      latitude: -23.55 + index * 0.0001,
      longitude: -46.63,
    })),
    Array.from({ length: people }, (_, index) => ({
      latitude: -23.55,
      longitude: -46.63 + index * 0.0001,
    })),
  ],
};

function percentile(samples: number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))] ?? 0;
}

function time(work: () => void, runs: number): number[] {
  for (let warmUp = 0; warmUp < 2; warmUp++) work();
  return Array.from({ length: runs }, () => {
    const startedAt = performance.now();
    work();
    return performance.now() - startedAt;
  });
}

console.log(`Node ${process.version}`);
console.log(
  "| Geometria | Pedidos × entregadores | Húngaro (mediana / p95) | Guloso (mediana) | Distância do guloso |",
);
console.log("| --- | --- | --- | --- | --- |");
for (const [geometry, build] of Object.entries(geometries)) {
  for (const [orderCount, peopleCount, runs] of sizes) {
    const [orders, people] = build(orderCount, peopleCount);
    const matrix = orders.map((order) => people.map((person) => haversineKm(order, person)));

    const hungarianTimes = time(() => hungarian(matrix), runs);
    const greedyTimes = time(() => greedy(matrix), runs);
    const extra = greedy(matrix).totalCost / hungarian(matrix).totalCost - 1;

    console.log(
      `| ${geometry} | ${orderCount} × ${peopleCount} | ${percentile(hungarianTimes, 0.5).toFixed(2)} ms / ${percentile(hungarianTimes, 0.95).toFixed(2)} ms | ${percentile(greedyTimes, 0.5).toFixed(2)} ms | +${(extra * 100).toFixed(1)}% |`,
    );
  }
}
