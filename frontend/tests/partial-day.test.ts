import { describe, expect, it } from "vitest";
import { dayAxisLabel, dayTooltipTitle, splitPartialDay } from "@/utils/partial-day";

const today = "2026-10-25";
const days = [
  { date: "2026-10-23", revenue: 900, orders: 9 },
  { date: "2026-10-24", revenue: 1000, orders: 10 },
  { date: "2026-10-25", revenue: 120, orders: 1 },
];

describe("partial day", () => {
  it("keeps closed days solid and dashes only the stretch into today", () => {
    const split = splitPartialDay(days, today);

    expect(split.map((day) => day.settled)).toEqual([900, 1000, null]);
    // Ontem entra nas duas séries: sem isso a linha tracejada começaria solta, em hoje.
    expect(split.map((day) => day.partial)).toEqual([null, 1000, 120]);
  });

  it("leaves a period that ends before today fully solid", () => {
    const split = splitPartialDay(days.slice(0, 2), today);

    expect(split.map((day) => day.settled)).toEqual([900, 1000]);
    expect(split.map((day) => day.partial)).toEqual([null, null]);
  });

  it("keeps the original fields for the tooltip", () => {
    expect(splitPartialDay(days, today)[2]).toMatchObject({ date: today, orders: 1 });
  });

  it("names today on the axis and in the tooltip", () => {
    expect(dayAxisLabel(today, today)).toBe("Hoje");
    expect(dayTooltipTitle(today, today)).toBe("Hoje, em andamento");
    expect(dayAxisLabel("2026-10-24", today)).not.toBe("Hoje");
  });
});
