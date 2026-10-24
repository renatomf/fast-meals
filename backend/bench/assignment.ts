import { greedy } from "../src/algorithms/greedy.ts";
import { haversineKm, type Coordinates } from "../src/algorithms/haversine.ts";
import { hungarian } from "../src/algorithms/hungarian.ts";
import { createRandom } from "../src/db/random.ts";

// npm run bench:assignment — tempo do Húngaro e do guloso em matrizes de distância reais
// (pontos aleatórios numa área de ~20 × 20 km em São Paulo), com semente fixa.

const sizes: [orders: number, people: number, runs: number][] = [
  [50, 30, 50],
  [200, 200, 15],
  [500, 500, 5],
];

const random = createRandom(2_026);

function randomPoint(): Coordinates {
  return {
    latitude: -23.56 + (random.next() - 0.5) * 0.18,
    longitude: -46.65 + (random.next() - 0.5) * 0.18,
  };
}

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
  "| Pedidos × entregadores | Húngaro (mediana / p95) | Guloso (mediana) | Distância do guloso |",
);
console.log("| --- | --- | --- | --- |");
for (const [orderCount, peopleCount, runs] of sizes) {
  const orders = Array.from({ length: orderCount }, randomPoint);
  const people = Array.from({ length: peopleCount }, randomPoint);
  const matrix = orders.map((order) => people.map((person) => haversineKm(order, person)));

  const hungarianTimes = time(() => hungarian(matrix), runs);
  const greedyTimes = time(() => greedy(matrix), runs);
  const extra = greedy(matrix).totalCost / hungarian(matrix).totalCost - 1;

  console.log(
    `| ${orderCount} × ${peopleCount} | ${percentile(hungarianTimes, 0.5).toFixed(2)} ms / ${percentile(hungarianTimes, 0.95).toFixed(2)} ms | ${percentile(greedyTimes, 0.5).toFixed(2)} ms | +${(extra * 100).toFixed(1)}% |`,
  );
}
