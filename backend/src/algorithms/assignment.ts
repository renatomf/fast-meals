// Resultado de qualquer algoritmo de atribuição sobre uma matriz de custo linhas × colunas
// (pedidos × entregadores): para cada linha, a coluna escolhida, ou null se ficou de fora.
export type AssignmentResult = {
  rowToColumn: (number | null)[];
  totalCost: number;
};
