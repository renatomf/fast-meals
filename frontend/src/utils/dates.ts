// Datas de calendário (YYYY-MM-DD) no fuso de São Paulo, o mesmo dos relatórios e filtros
// do backend: o "hoje" do painel não vira amanhã às 21h por causa do UTC.
const saoPauloDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayInSaoPaulo(now: Date = new Date()): string {
  return saoPauloDay.format(now);
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days))
    .toISOString()
    .slice(0, 10);
}

export type DateRange = { startDate: string; endDate: string };

// Os últimos N dias até hoje, e os N dias imediatamente antes, para comparação.
export function lastDays(
  days: number,
  now: Date = new Date(),
): { current: DateRange; previous: DateRange } {
  const endDate = todayInSaoPaulo(now);
  const startDate = addDays(endDate, -(days - 1));
  return {
    current: { startDate, endDate },
    previous: { startDate: addDays(startDate, -days), endDate: addDays(startDate, -1) },
  };
}
