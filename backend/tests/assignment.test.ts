import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AssignmentResult } from "../src/algorithms/assignment.ts";
import { greedy } from "../src/algorithms/greedy.ts";
import { hungarian } from "../src/algorithms/hungarian.ts";

type Matrix = number[][];

// Oráculo: testa todas as atribuições possíveis. É O(m!/(m-n)!), por isso só serve para
// matrizes pequenas, e é exatamente por isso que o Húngaro existe.
function bruteForceMinimum(cost: Matrix): number {
  const rows = cost.length;
  const columns = cost[0]?.length ?? 0;
  if (rows === 0 || columns === 0) return 0;
  // Com mais linhas que colunas, cada coluna escolhe uma linha: transpõe e resolve igual.
  if (rows > columns) {
    return bruteForceMinimum(
      Array.from({ length: columns }, (_, column) => cost.map((row) => row[column] ?? 0)),
    );
  }
  let best = Number.POSITIVE_INFINITY;
  const used = new Array<boolean>(columns).fill(false);
  function visit(row: number, sum: number) {
    if (sum >= best) return;
    if (row === rows) {
      best = sum;
      return;
    }
    for (let column = 0; column < columns; column++) {
      if (used[column]) continue;
      used[column] = true;
      visit(row + 1, sum + (cost[row]?.[column] ?? 0));
      used[column] = false;
    }
  }
  visit(0, 0);
  return best;
}

function costOf(cost: Matrix, result: AssignmentResult): number {
  return result.rowToColumn.reduce<number>(
    (sum, column, row) => (column === null ? sum : sum + (cost[row]?.[column] ?? Number.NaN)),
    0,
  );
}

function expectValidAssignment(cost: Matrix, result: AssignmentResult) {
  const rows = cost.length;
  const columns = cost[0]?.length ?? 0;
  expect(result.rowToColumn).toHaveLength(rows);
  const chosen = result.rowToColumn.filter((column): column is number => column !== null);
  // Cada entregador recebe no máximo um pedido, e ninguém fica parado se houver trabalho.
  expect(new Set(chosen).size).toBe(chosen.length);
  expect(chosen).toHaveLength(Math.min(rows, columns));
  for (const column of chosen) expect(column).toBeGreaterThanOrEqual(0);
  for (const column of chosen) expect(column).toBeLessThan(columns);
  expect(result.totalCost).toBeCloseTo(costOf(cost, result), 9);
}

const matrix = (maxRows: number, maxColumns: number) =>
  fc
    .tuple(fc.integer({ min: 0, max: maxRows }), fc.integer({ min: 0, max: maxColumns }))
    .chain(([rows, columns]) =>
      fc.array(
        fc.array(fc.integer({ min: 0, max: 1_000 }), { minLength: columns, maxLength: columns }),
        {
          minLength: rows,
          maxLength: rows,
        },
      ),
    )
    // Linhas sem colunas não são uma matriz válida de pedidos × entregadores.
    .filter((cost) => cost.length === 0 || (cost[0]?.length ?? 0) > 0);

describe("hungarian: caso com solução", () => {
  it("solves the textbook 3×3 example with total 5", () => {
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];

    const result = hungarian(cost);

    expect(result).toEqual({ rowToColumn: [1, 0, 2], totalCost: 5 });
  });

  it("finds the cheaper crossing assignment that greedy misses", () => {
    // O guloso pega o 1 (menor célula) e fica preso ao 100: 101 contra 4.
    const cost = [
      [1, 2],
      [2, 100],
    ];

    expect(hungarian(cost)).toEqual({ rowToColumn: [1, 0], totalCost: 4 });
    expect(greedy(cost).totalCost).toBe(101);
  });

  it("leaves the extra orders unassigned when there are more orders than people", () => {
    const cost = [[5], [1], [3]];

    expect(hungarian(cost)).toEqual({ rowToColumn: [null, 0, null], totalCost: 1 });
  });

  it("leaves extra people idle when there are more people than orders", () => {
    const cost = [[7, 2, 9]];

    expect(hungarian(cost)).toEqual({ rowToColumn: [1], totalCost: 2 });
  });

  it("handles fractional distances", () => {
    const cost = [
      [2.45, 1.87],
      [1.1, 3.3],
    ];

    const result = hungarian(cost);

    expect(result.rowToColumn).toEqual([1, 0]);
    expect(result.totalCost).toBeCloseTo(2.97, 9);
  });
});

describe("hungarian: sem entregadores disponíveis", () => {
  it("assigns nothing when there are orders but no people", () => {
    expect(hungarian([[], []])).toEqual({ rowToColumn: [null, null], totalCost: 0 });
  });

  it("assigns nothing when there are no orders", () => {
    expect(hungarian([])).toEqual({ rowToColumn: [], totalCost: 0 });
  });
});

describe("hungarian: properties", () => {
  it("always matches the brute-force optimum on matrices up to 6×7 and 7×6", () => {
    fc.assert(
      fc.property(fc.oneof(matrix(6, 7), matrix(7, 6)), (cost) => {
        const result = hungarian(cost);
        expectValidAssignment(cost, result);
        expect(result.totalCost).toBe(bruteForceMinimum(cost));
      }),
      { numRuns: 500 },
    );
  });

  it("is never worse than greedy", () => {
    fc.assert(
      fc.property(matrix(12, 12), (cost) => {
        expect(hungarian(cost).totalCost).toBeLessThanOrEqual(greedy(cost).totalCost);
      }),
      { numRuns: 300 },
    );
  });

  it("gives the same answer for the same input, including ties", () => {
    fc.assert(
      fc.property(matrix(8, 8), (cost) => {
        expect(hungarian(cost)).toEqual(hungarian(cost));
      }),
    );
    const allEqual = [
      [3, 3, 3],
      [3, 3, 3],
    ];
    expect(hungarian(allEqual).rowToColumn).toEqual(hungarian(allEqual).rowToColumn);
  });

  it("solves 500×500 in well under the 2 s budget", () => {
    const random = fc.sample(fc.integer({ min: 1, max: 10_000 }), { numRuns: 500 * 500, seed: 42 });
    const cost = Array.from({ length: 500 }, (_, row) => random.slice(row * 500, row * 500 + 500));

    const startedAt = performance.now();
    const result = hungarian(cost);
    const elapsedMs = performance.now() - startedAt;

    expectValidAssignment(cost, result);
    expect(elapsedMs).toBeLessThan(2_000);
  });
});

describe("greedy (baseline)", () => {
  it("returns a valid assignment", () => {
    fc.assert(
      fc.property(matrix(8, 8), (cost) => {
        expectValidAssignment(cost, greedy(cost));
      }),
    );
  });

  it("takes the cheapest remaining pair first, breaking ties by row then column", () => {
    const cost = [
      [5, 1],
      [1, 5],
    ];

    expect(greedy(cost)).toEqual({ rowToColumn: [1, 0], totalCost: 2 });
  });
});
