import { assertValidCostMatrix, type AssignmentResult, type CostMatrix } from "./assignment.ts";

// Algoritmo Húngaro com potenciais (variante e-maxx / Jonker–Volgenant simplificada) para
// matriz retangular n × m com n ≤ m. Cada linha entra uma vez; a busca do caminho mais
// barato até uma coluna livre custa O(n·m), então o total é O(n²·m).
//
// u e v são os potenciais de linha e coluna: o custo reduzido a[i][j] - u[i] - v[j] nunca
// fica negativo, e as atribuições feitas são sempre arestas de custo reduzido zero.
// Arrays com índice 1: a coluna 0 é uma sentinela que marca "linha ainda sem coluna".
function solveRowsAtMostColumns(cost: CostMatrix, rows: number, columns: number): number[] {
  const u = new Float64Array(rows + 1);
  const v = new Float64Array(columns + 1);
  const columnOwner = new Int32Array(columns + 1); // linha dona de cada coluna (0 = livre)
  const previousColumn = new Int32Array(columns + 1); // caminho aumentante, para refazê-lo

  for (let row = 1; row <= rows; row++) {
    columnOwner[0] = row;
    let column = 0;
    const minReduced = new Float64Array(columns + 1).fill(Number.POSITIVE_INFINITY);
    const visited = new Uint8Array(columns + 1);

    do {
      visited[column] = 1;
      const owner = columnOwner[column] ?? 0;
      const ownerCosts = cost[owner - 1] ?? [];
      let delta = Number.POSITIVE_INFINITY;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= columns; candidate++) {
        if (visited[candidate]) continue;
        const reduced = (ownerCosts[candidate - 1] ?? 0) - (u[owner] ?? 0) - (v[candidate] ?? 0);
        if (reduced < (minReduced[candidate] ?? Number.POSITIVE_INFINITY)) {
          minReduced[candidate] = reduced;
          previousColumn[candidate] = column;
        }
        // "<" estrito: em empate fica a coluna de menor índice, o que torna o resultado
        // determinístico para a mesma entrada.
        if ((minReduced[candidate] ?? Number.POSITIVE_INFINITY) < delta) {
          delta = minReduced[candidate] ?? Number.POSITIVE_INFINITY;
          nextColumn = candidate;
        }
      }
      // Com n ≤ m e custos finitos sempre há uma coluna livre alcançável. Se não houver, é
      // bug: falha aqui em vez de repetir o laço para sempre e travar o processo.
      if (!Number.isFinite(delta)) {
        throw new Error("Hungarian: no reachable free column; cost matrix or invariants broken");
      }
      for (let index = 0; index <= columns; index++) {
        if (visited[index]) {
          const indexOwner = columnOwner[index] ?? 0;
          u[indexOwner] = (u[indexOwner] ?? 0) + delta;
          v[index] = (v[index] ?? 0) - delta;
        } else {
          minReduced[index] = (minReduced[index] ?? 0) - delta;
        }
      }
      column = nextColumn;
    } while ((columnOwner[column] ?? 0) !== 0);

    // Inverte o caminho aumentante: cada coluna passa para a linha que vinha antes dela.
    do {
      const previous = previousColumn[column] ?? 0;
      columnOwner[column] = columnOwner[previous] ?? 0;
      column = previous;
    } while (column !== 0);
  }

  const rowToColumn = new Array<number>(rows).fill(-1);
  for (let column = 1; column <= columns; column++) {
    const owner = columnOwner[column] ?? 0;
    if (owner !== 0) rowToColumn[owner - 1] = column - 1;
  }
  return rowToColumn;
}

export function hungarian(cost: CostMatrix): AssignmentResult {
  const { rows, columns } = assertValidCostMatrix(cost);
  if (rows === 0 || columns === 0) {
    return { rowToColumn: new Array<null>(rows).fill(null), totalCost: 0 };
  }

  let rowToColumn: (number | null)[];
  if (rows <= columns) {
    rowToColumn = solveRowsAtMostColumns(cost, rows, columns);
  } else {
    // Mais pedidos que entregadores: resolve a transposta (cada entregador escolhe um pedido)
    // e inverte. Os pedidos que nenhum entregador escolheu ficam null.
    const transposed = Array.from({ length: columns }, (_, column) =>
      cost.map((row) => row[column] ?? 0),
    );
    const columnToRow = solveRowsAtMostColumns(transposed, columns, rows);
    rowToColumn = new Array<number | null>(rows).fill(null);
    columnToRow.forEach((row, column) => {
      rowToColumn[row] = column;
    });
  }

  const totalCost = rowToColumn.reduce<number>(
    (sum, column, row) => (column === null ? sum : sum + (cost[row]?.[column] ?? 0)),
    0,
  );
  return { rowToColumn, totalCost };
}
