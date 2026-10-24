import type { AssignmentResult } from "./assignment.ts";

// Baseline para comparação: pega sempre o par pedido–entregador mais barato que sobrou.
// É O(n·m·log(n·m)) e costuma acertar, mas uma escolha boa agora pode forçar uma péssima
// depois, e é aí que o Húngaro ganha. Empates: menor linha, depois menor coluna.
export function greedy(cost: readonly (readonly number[])[]): AssignmentResult {
  const rows = cost.length;
  const columns = cost[0]?.length ?? 0;
  const cells: { row: number; column: number; value: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      cells.push({ row, column, value: cost[row]?.[column] ?? 0 });
    }
  }
  cells.sort((a, b) => a.value - b.value || a.row - b.row || a.column - b.column);

  const rowToColumn = new Array<number | null>(rows).fill(null);
  const takenColumns = new Set<number>();
  let totalCost = 0;
  let remaining = Math.min(rows, columns);
  for (const cell of cells) {
    if (remaining === 0) break;
    if (rowToColumn[cell.row] !== null || takenColumns.has(cell.column)) continue;
    rowToColumn[cell.row] = cell.column;
    takenColumns.add(cell.column);
    totalCost += cell.value;
    remaining--;
  }
  return { rowToColumn, totalCost };
}
