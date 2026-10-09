import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateShort,
  formatMoney,
  formatMoneyRange,
  formatNumber,
  localDateKey
} from "@/lib/format";

describe("number formatting", () => {
  it("formats numbers with Latin digits", () => {
    expect(formatNumber(1234.5)).toBe("1,234.5");
  });

  it("appends the Arabic currency label for money", () => {
    expect(formatMoney(1000)).toBe("1,000 ج.م");
  });

  it("collapses a money range with one value", () => {
    expect(formatMoneyRange(5, 5)).toBe(formatMoney(5));
  });

  it("renders a money range with a dash between the bounds", () => {
    expect(formatMoneyRange(5, 10)).toBe("5 – 10 ج.م");
  });
});

describe("date formatting", () => {
  it("formats a date with a short Arabic month and Latin digits", () => {
    expect(formatDate("2026-01-05T12:00:00")).toBe("05 يناير 2026");
  });

  it("formats a short date without a month name", () => {
    expect(formatDateShort("2026-01-05T12:00:00")).toContain("2026");
  });

  it("builds a local YYYY-MM-DD key with zero padding", () => {
    expect(localDateKey("2026-01-05T12:00:00")).toBe("2026-01-05");
    expect(localDateKey("2026-11-09T12:00:00")).toBe("2026-11-09");
  });
});
