import { describe, it, expect } from "vitest";

function safeParseFinancial(value: string | null | undefined, fallback: number = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = parseFloat(value);
  if (isNaN(parsed) || !isFinite(parsed)) return fallback;
  return parsed;
}

function calculateRetentionAmount(
  subtotal: number,
  retentionRate: number,
  retentionCapAmount: number,
  previousRetention: number
): number {
  if (isNaN(subtotal) || !isFinite(subtotal)) return 0;
  if (retentionRate < 0 || retentionRate > 100) return 0;

  let thisClaimRetention = subtotal * retentionRate / 100;

  if (previousRetention + thisClaimRetention > retentionCapAmount) {
    thisClaimRetention = Math.max(0, retentionCapAmount - previousRetention);
  }

  return safeParseFinancial(thisClaimRetention.toFixed(2), 0);
}

function calculatePanelRevenue(
  sellRateM2: number,
  sellRateM3: number,
  area: number,
  volume: number
): number {
  return (sellRateM2 * area) + (sellRateM3 * volume);
}

describe("safeParseFinancial - Valid Number Parsing", () => {
  it("should parse a valid integer string", () => {
    expect(safeParseFinancial("100")).toBe(100);
  });

  it("should parse a valid decimal string", () => {
    expect(safeParseFinancial("99.95")).toBe(99.95);
  });

  it("should parse negative numbers", () => {
    expect(safeParseFinancial("-50.25")).toBe(-50.25);
  });

  it("should parse zero", () => {
    expect(safeParseFinancial("0")).toBe(0);
  });

  it("should parse very large numbers", () => {
    expect(safeParseFinancial("9999999999.99")).toBe(9999999999.99);
  });

  it("should parse very small decimals", () => {
    expect(safeParseFinancial("0.01")).toBe(0.01);
  });

  it("should parse scientific notation strings", () => {
    expect(safeParseFinancial("1e5")).toBe(100000);
  });

  it("should parse strings with leading zeros", () => {
    expect(safeParseFinancial("007.50")).toBe(7.5);
  });
});

describe("safeParseFinancial - Edge Cases", () => {
  it("should return fallback for null", () => {
    expect(safeParseFinancial(null)).toBe(0);
  });

  it("should return fallback for undefined", () => {
    expect(safeParseFinancial(undefined)).toBe(0);
  });

  it("should return fallback for empty string", () => {
    expect(safeParseFinancial("")).toBe(0);
  });

  it("should return fallback for NaN string", () => {
    expect(safeParseFinancial("NaN")).toBe(0);
  });

  it("should return fallback for Infinity string", () => {
    expect(safeParseFinancial("Infinity")).toBe(0);
  });

  it("should return fallback for negative Infinity string", () => {
    expect(safeParseFinancial("-Infinity")).toBe(0);
  });

  it("should return fallback for non-numeric string", () => {
    expect(safeParseFinancial("abc")).toBe(0);
  });

  it("should return custom fallback when provided", () => {
    expect(safeParseFinancial(null, 10)).toBe(10);
    expect(safeParseFinancial(undefined, 5)).toBe(5);
    expect(safeParseFinancial("", 99.99)).toBe(99.99);
  });

  it("should return custom fallback for invalid strings", () => {
    expect(safeParseFinancial("not-a-number", 42)).toBe(42);
  });

  it("should parse strings with trailing text by using parseFloat behavior", () => {
    expect(safeParseFinancial("123.45abc")).toBe(123.45);
  });
});

describe("safeParseFinancial - Currency and Rounding", () => {
  it("should correctly parse two-decimal financial values", () => {
    expect(safeParseFinancial("1234.56")).toBe(1234.56);
  });

  it("should parse values that represent cents accurately", () => {
    expect(safeParseFinancial("0.99")).toBe(0.99);
  });

  it("should handle toFixed(2) output correctly", () => {
    const value = (100.1 + 200.2).toFixed(2);
    expect(safeParseFinancial(value)).toBeCloseTo(300.3, 2);
  });

  it("should correctly round-trip through toFixed(2)", () => {
    const original = 12345.678;
    const fixed = original.toFixed(2);
    const result = safeParseFinancial(fixed);
    expect(result).toBe(12345.68);
  });
});

describe("safeParseFinancial - Percentage Values", () => {
  it("should parse 0% correctly", () => {
    expect(safeParseFinancial("0")).toBe(0);
  });

  it("should parse 100% correctly", () => {
    expect(safeParseFinancial("100")).toBe(100);
  });

  it("should parse fractional percentages", () => {
    expect(safeParseFinancial("10.5")).toBe(10.5);
  });

  it("should parse negative percentages (edge case)", () => {
    expect(safeParseFinancial("-5")).toBe(-5);
  });

  it("should parse percentage values greater than 100", () => {
    expect(safeParseFinancial("150")).toBe(150);
  });
});

describe("Retention Calculations", () => {
  it("should calculate basic retention correctly", () => {
    const result = calculateRetentionAmount(10000, 10, Infinity, 0);
    expect(result).toBe(1000);
  });

  it("should calculate retention with a 5% rate", () => {
    const result = calculateRetentionAmount(50000, 5, Infinity, 0);
    expect(result).toBe(2500);
  });

  it("should cap retention at the cap amount", () => {
    const contractValue = 100000;
    const capPct = 5;
    const retentionCapAmount = contractValue * capPct / 100;
    const result = calculateRetentionAmount(100000, 10, retentionCapAmount, 0);
    expect(result).toBe(5000);
  });

  it("should reduce retention when previous retention approaches cap", () => {
    const retentionCapAmount = 5000;
    const result = calculateRetentionAmount(100000, 10, retentionCapAmount, 4000);
    expect(result).toBe(1000);
  });

  it("should return 0 when cap is already reached", () => {
    const retentionCapAmount = 5000;
    const result = calculateRetentionAmount(100000, 10, retentionCapAmount, 5000);
    expect(result).toBe(0);
  });

  it("should return 0 when cap is exceeded by previous retention", () => {
    const retentionCapAmount = 5000;
    const result = calculateRetentionAmount(100000, 10, retentionCapAmount, 6000);
    expect(result).toBe(0);
  });

  it("should return 0 for invalid subtotal (NaN)", () => {
    const result = calculateRetentionAmount(NaN, 10, Infinity, 0);
    expect(result).toBe(0);
  });

  it("should return 0 for invalid subtotal (Infinity)", () => {
    const result = calculateRetentionAmount(Infinity, 10, Infinity, 0);
    expect(result).toBe(0);
  });

  it("should return 0 for retention rate below 0", () => {
    const result = calculateRetentionAmount(10000, -5, Infinity, 0);
    expect(result).toBe(0);
  });

  it("should return 0 for retention rate above 100", () => {
    const result = calculateRetentionAmount(10000, 105, Infinity, 0);
    expect(result).toBe(0);
  });

  it("should handle zero subtotal correctly", () => {
    const result = calculateRetentionAmount(0, 10, Infinity, 0);
    expect(result).toBe(0);
  });

  it("should handle zero retention rate correctly", () => {
    const result = calculateRetentionAmount(10000, 0, Infinity, 0);
    expect(result).toBe(0);
  });

  it("should produce values rounded to 2 decimal places", () => {
    const result = calculateRetentionAmount(33333, 10, Infinity, 0);
    const decimalPlaces = result.toString().split(".")[1]?.length || 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});

describe("Panel Revenue Calculations", () => {
  it("should calculate revenue from area rate only", () => {
    const revenue = calculatePanelRevenue(100, 0, 10, 0);
    expect(revenue).toBe(1000);
  });

  it("should calculate revenue from volume rate only", () => {
    const revenue = calculatePanelRevenue(0, 500, 0, 5);
    expect(revenue).toBe(2500);
  });

  it("should calculate combined revenue from area and volume", () => {
    const revenue = calculatePanelRevenue(100, 500, 10, 5);
    expect(revenue).toBe(3500);
  });

  it("should return 0 when all rates and dimensions are 0", () => {
    const revenue = calculatePanelRevenue(0, 0, 0, 0);
    expect(revenue).toBe(0);
  });

  it("should handle typical real-world panel values", () => {
    const sellRateM2 = safeParseFinancial("250.00");
    const sellRateM3 = safeParseFinancial("1200.00");
    const area = safeParseFinancial("12.5");
    const volume = safeParseFinancial("2.8");
    const revenue = calculatePanelRevenue(sellRateM2, sellRateM3, area, volume);
    expect(revenue).toBeCloseTo(6485, 0);
  });
});
