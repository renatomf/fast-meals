import { describe, expect, it } from "vitest";
import { centsToDecimal, toCents } from "../src/utils/money.ts";

describe("money", () => {
  it.each([
    ["32.90", 3290],
    [32.9, 3290],
    ["0.05", 5],
    [1234567.89, 123456789],
  ])("converts %s to %i cents", (amount, cents) => {
    expect(toCents(amount)).toBe(cents);
  });

  it("adds amounts without floating-point drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(centsToDecimal(toCents(0.1) + toCents(0.2))).toBe("0.30");
  });

  it("formats cents with exactly two decimals, as DECIMAL(10,2) expects", () => {
    expect(centsToDecimal(3290)).toBe("32.90");
    expect(centsToDecimal(5)).toBe("0.05");
  });

  it("refuses values that are not numbers", () => {
    expect(() => toCents("abc")).toThrow(RangeError);
  });
});
