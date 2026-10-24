// Dinheiro circula em centavos inteiros: somar 0.1 + 0.2 em ponto flutuante dá
// 0.30000000000000004, somar 10 + 20 centavos dá 30. O banco guarda DECIMAL(10,2)
// e devolve string; a conversão acontece só nas bordas.

export function toCents(amount: number | string): number {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Invalid monetary amount: ${amount}`);
  return cents;
}

export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}
