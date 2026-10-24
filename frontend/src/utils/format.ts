// Formatação para exibição, sempre por Intl e em pt-BR. Funções puras: o "agora" entra
// como parâmetro, o que deixa os testes determinísticos.

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatMoney(value: number): string {
  return money.format(value);
}

export function formatInteger(value: number): string {
  return integer.format(value);
}

export function formatDecimal(value: number): string {
  return decimal.format(value);
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

// "2026-10-20" → "20 de out." (data de calendário, sem fuso).
export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return shortDate.format(new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

// "agora", "há 4 minutos", "há 2 horas", "ontem"... Para tempos de operação, onde a hora
// exata importa menos que a distância.
export function formatRelative(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  if (Math.abs(seconds) < 45) return "agora";
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size || unit === "minute") {
      return relative.format(Math.round(seconds / size), unit);
    }
  }
  return relative.format(0, "minute");
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${formatDecimal(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${Math.round(minutes % 60)} min`;
}
