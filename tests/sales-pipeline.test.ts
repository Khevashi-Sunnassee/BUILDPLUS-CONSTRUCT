import { describe, it, expect } from "vitest";
import {
  SALES_STAGES,
  STAGE_STATUSES,
  STAGE_LABELS,
  STAGE_COLORS,
  type SalesStage,
} from "@shared/sales-pipeline";

describe("Sales Pipeline Constants", () => {
  it("should define exactly 6 sales stages", () => {
    expect(SALES_STAGES).toHaveLength(6);
    expect(SALES_STAGES).toContain("OPPORTUNITY");
    expect(SALES_STAGES).toContain("LOST");
    expect(SALES_STAGES).toContain("AWARDED");
  });

  it("should have statuses for every stage", () => {
    for (const stage of SALES_STAGES) {
      expect(STAGE_STATUSES[stage]).toBeDefined();
      expect(STAGE_STATUSES[stage].length).toBeGreaterThan(0);
    }
  });

  it("should have labels for every stage", () => {
    for (const stage of SALES_STAGES) {
      expect(STAGE_LABELS[stage]).toBeDefined();
      expect(typeof STAGE_LABELS[stage]).toBe("string");
    }
  });

  it("should have colors for every stage", () => {
    for (const stage of SALES_STAGES) {
      expect(STAGE_COLORS[stage]).toBeDefined();
      expect(STAGE_COLORS[stage]).toContain("bg-");
      expect(STAGE_COLORS[stage]).toContain("text-");
    }
  });

  it("each status should have value and label properties", () => {
    for (const stage of SALES_STAGES) {
      for (const status of STAGE_STATUSES[stage]) {
        expect(status).toHaveProperty("value");
        expect(status).toHaveProperty("label");
        expect(typeof status.value).toBe("string");
        expect(typeof status.label).toBe("string");
      }
    }
  });

  it("status values should be unique within each stage", () => {
    for (const stage of SALES_STAGES) {
      const values = STAGE_STATUSES[stage].map((s) => s.value);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    }
  });

  it("status values should be unique across all stages", () => {
    const allValues: string[] = [];
    for (const stage of SALES_STAGES) {
      for (const status of STAGE_STATUSES[stage]) {
        allValues.push(status.value);
      }
    }
    const unique = new Set(allValues);
    expect(unique.size).toBe(allValues.length);
  });
});
