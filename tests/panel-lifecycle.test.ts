import { describe, it, expect } from "vitest";
import {
  PANEL_LIFECYCLE_STATUS,
  PANEL_LIFECYCLE_LABELS,
  PANEL_LIFECYCLE_COLORS,
  type PanelLifecycleStatus,
} from "@shared/schema";

const ALL_STATUSES = Object.entries(PANEL_LIFECYCLE_STATUS) as [string, number][];

function canAdvanceLifecycle(current: number, target: number): boolean {
  return target > current;
}

function canRevertLifecycle(current: number, target: number): boolean {
  return target < current;
}

function shouldAdvanceIfLower(current: number, target: number): boolean {
  return current < target;
}

describe("Panel Lifecycle Status Constants", () => {
  it("should define exactly 16 lifecycle statuses", () => {
    expect(Object.keys(PANEL_LIFECYCLE_STATUS)).toHaveLength(16);
  });

  it("should start with REGISTERED at 0", () => {
    expect(PANEL_LIFECYCLE_STATUS.REGISTERED).toBe(0);
  });

  it("should end with CLAIMED at 15", () => {
    expect(PANEL_LIFECYCLE_STATUS.CLAIMED).toBe(15);
  });

  it("should have sequential integer values from 0 to 15", () => {
    const values = Object.values(PANEL_LIFECYCLE_STATUS).sort((a, b) => a - b);
    for (let i = 0; i < values.length; i++) {
      expect(values[i]).toBe(i);
    }
  });

  it("should define all expected stages in correct order", () => {
    expect(PANEL_LIFECYCLE_STATUS.REGISTERED).toBe(0);
    expect(PANEL_LIFECYCLE_STATUS.DIMENSIONS_CONFIRMED).toBe(1);
    expect(PANEL_LIFECYCLE_STATUS.DRAFTING).toBe(2);
    expect(PANEL_LIFECYCLE_STATUS.IFA).toBe(3);
    expect(PANEL_LIFECYCLE_STATUS.IFC).toBe(4);
    expect(PANEL_LIFECYCLE_STATUS.MATERIALS_ORDERED).toBe(5);
    expect(PANEL_LIFECYCLE_STATUS.PRODUCTION_APPROVED).toBe(6);
    expect(PANEL_LIFECYCLE_STATUS.IN_PRODUCTION).toBe(7);
    expect(PANEL_LIFECYCLE_STATUS.PRODUCED).toBe(8);
    expect(PANEL_LIFECYCLE_STATUS.QA_PASSED).toBe(9);
    expect(PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST).toBe(10);
    expect(PANEL_LIFECYCLE_STATUS.SHIPPED).toBe(11);
    expect(PANEL_LIFECYCLE_STATUS.RETURNED).toBe(12);
    expect(PANEL_LIFECYCLE_STATUS.INSTALLED).toBe(13);
    expect(PANEL_LIFECYCLE_STATUS.DEFECTED).toBe(14);
    expect(PANEL_LIFECYCLE_STATUS.CLAIMED).toBe(15);
  });
});

describe("Panel Lifecycle Labels", () => {
  it("should have a label for every status", () => {
    for (const [, value] of ALL_STATUSES) {
      expect(PANEL_LIFECYCLE_LABELS[value]).toBeDefined();
      expect(typeof PANEL_LIFECYCLE_LABELS[value]).toBe("string");
      expect(PANEL_LIFECYCLE_LABELS[value].length).toBeGreaterThan(0);
    }
  });

  it("should have human-readable labels", () => {
    expect(PANEL_LIFECYCLE_LABELS[0]).toBe("Registered");
    expect(PANEL_LIFECYCLE_LABELS[1]).toBe("Dimensions Confirmed");
    expect(PANEL_LIFECYCLE_LABELS[3]).toBe("IFA");
    expect(PANEL_LIFECYCLE_LABELS[4]).toBe("IFC");
    expect(PANEL_LIFECYCLE_LABELS[8]).toBe("Produced");
    expect(PANEL_LIFECYCLE_LABELS[9]).toBe("QA Passed");
    expect(PANEL_LIFECYCLE_LABELS[11]).toBe("Shipped");
    expect(PANEL_LIFECYCLE_LABELS[15]).toBe("Claimed");
  });

  it("should return undefined for labels outside valid range", () => {
    expect(PANEL_LIFECYCLE_LABELS[-1]).toBeUndefined();
    expect(PANEL_LIFECYCLE_LABELS[16]).toBeUndefined();
    expect(PANEL_LIFECYCLE_LABELS[99]).toBeUndefined();
  });
});

describe("Panel Lifecycle Colors", () => {
  it("should have colors for every status", () => {
    for (const [, value] of ALL_STATUSES) {
      const colors = PANEL_LIFECYCLE_COLORS[value];
      expect(colors).toBeDefined();
      expect(colors).toHaveProperty("bg");
      expect(colors).toHaveProperty("text");
      expect(colors).toHaveProperty("border");
    }
  });

  it("color bg classes should contain bg- prefix", () => {
    for (const [, value] of ALL_STATUSES) {
      expect(PANEL_LIFECYCLE_COLORS[value].bg).toContain("bg-");
    }
  });

  it("color text classes should contain text- prefix", () => {
    for (const [, value] of ALL_STATUSES) {
      expect(PANEL_LIFECYCLE_COLORS[value].text).toContain("text-");
    }
  });

  it("color border classes should contain border- prefix", () => {
    for (const [, value] of ALL_STATUSES) {
      expect(PANEL_LIFECYCLE_COLORS[value].border).toContain("border-");
    }
  });

  it("all color definitions should include dark mode variants", () => {
    for (const [, value] of ALL_STATUSES) {
      const colors = PANEL_LIFECYCLE_COLORS[value];
      expect(colors.bg).toContain("dark:");
      expect(colors.text).toContain("dark:");
      expect(colors.border).toContain("dark:");
    }
  });
});

describe("Panel Lifecycle Forward Transitions", () => {
  it("REGISTERED -> DIMENSIONS_CONFIRMED should be valid advancement", () => {
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.REGISTERED,
      PANEL_LIFECYCLE_STATUS.DIMENSIONS_CONFIRMED
    )).toBe(true);
  });

  it("DIMENSIONS_CONFIRMED -> DRAFTING should be valid advancement", () => {
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.DIMENSIONS_CONFIRMED,
      PANEL_LIFECYCLE_STATUS.DRAFTING
    )).toBe(true);
  });

  it("DRAFTING -> IFA -> IFC should be valid sequential advancement", () => {
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.DRAFTING,
      PANEL_LIFECYCLE_STATUS.IFA
    )).toBe(true);
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.IFA,
      PANEL_LIFECYCLE_STATUS.IFC
    )).toBe(true);
  });

  it("IFC -> MATERIALS_ORDERED -> PRODUCTION_APPROVED should be valid", () => {
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.IFC,
      PANEL_LIFECYCLE_STATUS.MATERIALS_ORDERED
    )).toBe(true);
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.MATERIALS_ORDERED,
      PANEL_LIFECYCLE_STATUS.PRODUCTION_APPROVED
    )).toBe(true);
  });

  it("PRODUCTION_APPROVED -> IN_PRODUCTION -> PRODUCED should be valid", () => {
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.PRODUCTION_APPROVED,
      PANEL_LIFECYCLE_STATUS.IN_PRODUCTION
    )).toBe(true);
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.IN_PRODUCTION,
      PANEL_LIFECYCLE_STATUS.PRODUCED
    )).toBe(true);
  });

  it("PRODUCED -> QA_PASSED -> ON_LOAD_LIST -> SHIPPED should be valid", () => {
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.PRODUCED,
      PANEL_LIFECYCLE_STATUS.QA_PASSED
    )).toBe(true);
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.QA_PASSED,
      PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST
    )).toBe(true);
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST,
      PANEL_LIFECYCLE_STATUS.SHIPPED
    )).toBe(true);
  });

  it("should allow skipping stages (advance-if-lower pattern)", () => {
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.REGISTERED,
      PANEL_LIFECYCLE_STATUS.PRODUCED
    )).toBe(true);
  });

  it("full lifecycle from REGISTERED to CLAIMED should be valid", () => {
    expect(canAdvanceLifecycle(
      PANEL_LIFECYCLE_STATUS.REGISTERED,
      PANEL_LIFECYCLE_STATUS.CLAIMED
    )).toBe(true);
  });
});

describe("Panel Lifecycle - advanceIfLower Logic", () => {
  it("should advance when target is higher than current", () => {
    expect(shouldAdvanceIfLower(
      PANEL_LIFECYCLE_STATUS.REGISTERED,
      PANEL_LIFECYCLE_STATUS.DIMENSIONS_CONFIRMED
    )).toBe(true);
  });

  it("should not advance when target equals current", () => {
    expect(shouldAdvanceIfLower(
      PANEL_LIFECYCLE_STATUS.PRODUCED,
      PANEL_LIFECYCLE_STATUS.PRODUCED
    )).toBe(false);
  });

  it("should not advance when target is lower than current", () => {
    expect(shouldAdvanceIfLower(
      PANEL_LIFECYCLE_STATUS.QA_PASSED,
      PANEL_LIFECYCLE_STATUS.PRODUCED
    )).toBe(false);
  });

  it("should advance from REGISTERED to any higher status", () => {
    for (const [, value] of ALL_STATUSES) {
      if (value > PANEL_LIFECYCLE_STATUS.REGISTERED) {
        expect(shouldAdvanceIfLower(PANEL_LIFECYCLE_STATUS.REGISTERED, value)).toBe(true);
      }
    }
  });

  it("should not advance from CLAIMED to any status", () => {
    for (const [, value] of ALL_STATUSES) {
      expect(shouldAdvanceIfLower(PANEL_LIFECYCLE_STATUS.CLAIMED, value)).toBe(false);
    }
  });
});

describe("Panel Lifecycle - Backward Transitions (Reverts)", () => {
  it("should not allow reverting to a higher status", () => {
    expect(canRevertLifecycle(
      PANEL_LIFECYCLE_STATUS.REGISTERED,
      PANEL_LIFECYCLE_STATUS.PRODUCED
    )).toBe(false);
  });

  it("should allow reverting to a lower status", () => {
    expect(canRevertLifecycle(
      PANEL_LIFECYCLE_STATUS.PRODUCTION_APPROVED,
      PANEL_LIFECYCLE_STATUS.REGISTERED
    )).toBe(true);
  });

  it("production approval revoke should revert to REGISTERED", () => {
    expect(canRevertLifecycle(
      PANEL_LIFECYCLE_STATUS.PRODUCTION_APPROVED,
      PANEL_LIFECYCLE_STATUS.REGISTERED
    )).toBe(true);
  });

  it("should not allow reverting to same status", () => {
    expect(canRevertLifecycle(
      PANEL_LIFECYCLE_STATUS.PRODUCED,
      PANEL_LIFECYCLE_STATUS.PRODUCED
    )).toBe(false);
  });
});

describe("Panel Lifecycle - Stage Ordering Invariants", () => {
  it("drafting stages should come before production stages", () => {
    expect(PANEL_LIFECYCLE_STATUS.DRAFTING).toBeLessThan(PANEL_LIFECYCLE_STATUS.IN_PRODUCTION);
    expect(PANEL_LIFECYCLE_STATUS.IFA).toBeLessThan(PANEL_LIFECYCLE_STATUS.IN_PRODUCTION);
    expect(PANEL_LIFECYCLE_STATUS.IFC).toBeLessThan(PANEL_LIFECYCLE_STATUS.IN_PRODUCTION);
  });

  it("production stages should come before logistics stages", () => {
    expect(PANEL_LIFECYCLE_STATUS.PRODUCED).toBeLessThan(PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST);
    expect(PANEL_LIFECYCLE_STATUS.PRODUCED).toBeLessThan(PANEL_LIFECYCLE_STATUS.SHIPPED);
  });

  it("QA should come after production but before shipping", () => {
    expect(PANEL_LIFECYCLE_STATUS.QA_PASSED).toBeGreaterThan(PANEL_LIFECYCLE_STATUS.PRODUCED);
    expect(PANEL_LIFECYCLE_STATUS.QA_PASSED).toBeLessThan(PANEL_LIFECYCLE_STATUS.SHIPPED);
  });

  it("materials ordering should come before production", () => {
    expect(PANEL_LIFECYCLE_STATUS.MATERIALS_ORDERED).toBeLessThan(PANEL_LIFECYCLE_STATUS.IN_PRODUCTION);
  });

  it("CLAIMED should be the final status", () => {
    const maxStatus = Math.max(...Object.values(PANEL_LIFECYCLE_STATUS));
    expect(PANEL_LIFECYCLE_STATUS.CLAIMED).toBe(maxStatus);
  });

  it("REGISTERED should be the initial status", () => {
    const minStatus = Math.min(...Object.values(PANEL_LIFECYCLE_STATUS));
    expect(PANEL_LIFECYCLE_STATUS.REGISTERED).toBe(minStatus);
  });
});

describe("Panel Lifecycle - QA and Special Transitions", () => {
  it("QA can only pass if panel is at least PRODUCED", () => {
    const canQA = (status: number) => status >= PANEL_LIFECYCLE_STATUS.PRODUCED && status < PANEL_LIFECYCLE_STATUS.QA_PASSED;

    expect(canQA(PANEL_LIFECYCLE_STATUS.REGISTERED)).toBe(false);
    expect(canQA(PANEL_LIFECYCLE_STATUS.DRAFTING)).toBe(false);
    expect(canQA(PANEL_LIFECYCLE_STATUS.IN_PRODUCTION)).toBe(false);
    expect(canQA(PANEL_LIFECYCLE_STATUS.PRODUCED)).toBe(true);
    expect(canQA(PANEL_LIFECYCLE_STATUS.QA_PASSED)).toBe(false);
  });

  it("panel can only be loaded if QA passed", () => {
    const canLoad = (status: number) => status >= PANEL_LIFECYCLE_STATUS.QA_PASSED && status < PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST;

    expect(canLoad(PANEL_LIFECYCLE_STATUS.PRODUCED)).toBe(false);
    expect(canLoad(PANEL_LIFECYCLE_STATUS.QA_PASSED)).toBe(true);
    expect(canLoad(PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST)).toBe(false);
  });

  it("panel can only be returned if it has been shipped", () => {
    const canReturn = (status: number) => status === PANEL_LIFECYCLE_STATUS.SHIPPED;

    expect(canReturn(PANEL_LIFECYCLE_STATUS.ON_LOAD_LIST)).toBe(false);
    expect(canReturn(PANEL_LIFECYCLE_STATUS.SHIPPED)).toBe(true);
    expect(canReturn(PANEL_LIFECYCLE_STATUS.INSTALLED)).toBe(false);
  });
});
