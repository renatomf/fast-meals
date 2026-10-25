import { formatShortDate } from "./format";

// O dia de hoje ainda está em andamento: comparado com dias inteiros, ele sempre parece uma
// queda. Os gráficos marcam esse dia como parcial em vez de deixá-lo passar por um tombo.

export function isPartialDay(date: string, today: string): boolean {
  return date === today;
}

export function dayAxisLabel(date: string, today: string): string {
  return isPartialDay(date, today) ? "Hoje" : formatShortDate(date);
}

export function dayTooltipTitle(date: string, today: string): string {
  return isPartialDay(date, today) ? "Hoje, em andamento" : formatShortDate(date);
}

type Day = { date: string; revenue: number };

export type SplitDay<T extends Day> = T & { settled: number | null; partial: number | null };

// Duas séries para o gráfico de área: "settled" com os dias fechados e "partial" só com o
// trecho de ontem até hoje, desenhado tracejado. Ontem entra nas duas para a linha não ter
// buraco. Sem hoje no período, tudo é "settled".
export function splitPartialDay<T extends Day>(days: T[], today: string): SplitDay<T>[] {
  return days.map((day, index) => {
    const isToday = isPartialDay(day.date, today);
    const leadsIntoToday = days[index + 1]?.date === today;
    return {
      ...day,
      settled: isToday ? null : day.revenue,
      partial: isToday || leadsIntoToday ? day.revenue : null,
    };
  });
}
