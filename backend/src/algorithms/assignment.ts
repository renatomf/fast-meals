// Matriz de custo linhas × colunas (pedidos × entregadores).
export type CostMatrix = readonly (readonly number[])[];

// Resultado de qualquer algoritmo de atribuição: para cada linha, a coluna escolhida, ou
// null se ficou de fora.
export type AssignmentResult = {
  rowToColumn: (number | null)[];
  totalCost: number;
};

// Linha irregular ou custo não finito é erro de quem chamou, e não pode passar adiante:
// com Infinity o Húngaro nunca acha coluna livre e não termina, e com uma linha curta a
// célula que falta viraria custo zero sem aviso.
export function assertValidCostMatrix(cost: CostMatrix): { rows: number; columns: number } {
  const rows = cost.length;
  const columns = cost[0]?.length ?? 0;
  cost.forEach((line, row) => {
    if (line.length !== columns) {
      throw new RangeError(
        `Cost matrix row ${row} has ${line.length} columns; expected ${columns}`,
      );
    }
    line.forEach((value, column) => {
      if (!Number.isFinite(value)) {
        throw new RangeError(`Cost matrix has a non-finite value at [${row}][${column}]`);
      }
    });
  });
  return { rows, columns };
}

// Cópia validada num array contíguo, linha após linha.
export function flattenCostMatrix(cost: CostMatrix): {
  values: Float64Array;
  rows: number;
  columns: number;
} {
  const { rows, columns } = assertValidCostMatrix(cost);
  const values = new Float64Array(rows * columns);
  cost.forEach((line, row) => values.set(line, row * columns));
  return { values, rows, columns };
}

// Leitura com índice que o laço já mantém dentro dos limites; o TypeScript estrito
// (noUncheckedIndexedAccess) não tem como provar isso sozinho.
export function f64(values: Float64Array, index: number): number {
  return values[index] as number;
}
