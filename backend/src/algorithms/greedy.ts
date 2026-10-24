import { f64, flattenCostMatrix, type AssignmentResult, type CostMatrix } from "./assignment.ts";

// Baseline para comparação: pega sempre o par pedido–entregador mais barato que sobrou.
// É O(n·m·log(n·m)) e costuma acertar, mas uma escolha boa agora pode forçar uma péssima
// depois, e é aí que o Húngaro ganha. Empates: menor linha, depois menor coluna.
export function greedy(cost: CostMatrix): AssignmentResult {
  const { values, rows, columns } = flattenCostMatrix(cost);
  // Ordena índices de célula, não objetos: com 500 × 500 são 250 mil números, não 250 mil
  // objetos. O índice já codifica linha e coluna, e a ordem dele desempata como prometido.
  const cells = Array.from({ length: rows * columns }, (_, index) => index);
  cells.sort((a, b) => f64(values, a) - f64(values, b) || a - b);

  const rowToColumn = new Array<number | null>(rows).fill(null);
  const takenColumns = new Uint8Array(columns);
  let totalCost = 0;
  let remaining = Math.min(rows, columns);
  for (const cell of cells) {
    if (remaining === 0) break;
    const row = Math.floor(cell / columns);
    const column = cell % columns;
    if (rowToColumn[row] !== null || takenColumns[column]) continue;
    rowToColumn[row] = column;
    takenColumns[column] = 1;
    totalCost += f64(values, cell);
    remaining--;
  }
  return { rowToColumn, totalCost };
}
