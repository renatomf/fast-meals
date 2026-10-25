import { describe, expect, it } from "vitest";
import { formatMinutes, formatMoney, formatRelative, formatShortDate } from "@/utils/format";

// O Intl separa "R$" do valor com espaço não separável (U+00A0).
const nbsp = " ";

describe("format", () => {
  it("formats money in reais", () => {
    expect(formatMoney(32.9)).toBe(`R$${nbsp}32,90`);
    expect(formatMoney(48250.9)).toBe(`R$${nbsp}48.250,90`);
  });

  it.each([
    ["2026-10-24T12:00:30Z", "agora"],
    ["2026-10-24T11:56:00Z", "há 4 minutos"],
    ["2026-10-24T10:00:00Z", "há 2 horas"],
    ["2026-10-23T12:00:00Z", "ontem"],
  ])("describes %s relative to noon as %s", (iso, expected) => {
    expect(formatRelative(iso, new Date("2026-10-24T12:00:00Z"))).toBe(expected);
  });

  it("formats a calendar date without shifting it by time zone", () => {
    expect(formatShortDate("2026-10-01")).toMatch(/^01 de out/);
  });

  it("formats durations in minutes and hours", () => {
    expect(formatMinutes(42.5)).toBe("42,5 min");
    expect(formatMinutes(95)).toBe("1 h 35 min");
  });
});
