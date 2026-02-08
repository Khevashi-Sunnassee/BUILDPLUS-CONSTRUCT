import { describe, it, expect } from "vitest";
import {
  JOB_PHASES,
  JOB_STATUSES,
  PHASE_ALLOWED_STATUSES,
  PHASE_ORDER,
  PHASE_TO_INT,
  INT_TO_PHASE,
  phaseToInt,
  intToPhase,
  jobHasCapability,
  isValidStatusForPhase,
  getDefaultStatusForPhase,
  canAdvanceToPhase,
  getPhaseLabel,
  getStatusLabel,
  isJobVisibleInDropdowns,
  mapOldStatusToPhaseAndStatus,
  type JobPhase,
  type JobStatus,
  type JobCapability,
} from "@shared/job-phases";

describe("Job Phases Constants", () => {
  it("should define exactly 5 phases", () => {
    expect(JOB_PHASES).toHaveLength(5);
  });

  it("should define exactly 6 statuses", () => {
    expect(JOB_STATUSES).toHaveLength(6);
  });

  it("should have allowed statuses for every phase", () => {
    for (const phase of JOB_PHASES) {
      expect(PHASE_ALLOWED_STATUSES[phase]).toBeDefined();
      expect(PHASE_ALLOWED_STATUSES[phase].length).toBeGreaterThan(0);
    }
  });

  it("should have LOST phase with only ARCHIVED status", () => {
    expect(PHASE_ALLOWED_STATUSES.LOST).toEqual(["ARCHIVED"]);
  });

  it("should have CONTRACTED phase allow all 6 statuses", () => {
    expect(PHASE_ALLOWED_STATUSES.CONTRACTED).toHaveLength(6);
  });
});

describe("Phase/Int Conversion", () => {
  it("phaseToInt should return correct integers", () => {
    expect(phaseToInt("OPPORTUNITY")).toBe(0);
    expect(phaseToInt("QUOTING")).toBe(1);
    expect(phaseToInt("WON_AWAITING_CONTRACT")).toBe(2);
    expect(phaseToInt("CONTRACTED")).toBe(3);
    expect(phaseToInt("LOST")).toBe(4);
  });

  it("intToPhase should return correct phases", () => {
    expect(intToPhase(0)).toBe("OPPORTUNITY");
    expect(intToPhase(1)).toBe("QUOTING");
    expect(intToPhase(2)).toBe("WON_AWAITING_CONTRACT");
    expect(intToPhase(3)).toBe("CONTRACTED");
    expect(intToPhase(4)).toBe("LOST");
  });

  it("intToPhase should default to OPPORTUNITY for unknown values", () => {
    expect(intToPhase(99)).toBe("OPPORTUNITY");
    expect(intToPhase(-1)).toBe("OPPORTUNITY");
  });

  it("should round-trip phase -> int -> phase", () => {
    for (const phase of JOB_PHASES) {
      const num = phaseToInt(phase);
      expect(intToPhase(num)).toBe(phase);
    }
  });
});

describe("Job Capabilities", () => {
  it("OPPORTUNITY should only have DOCUMENTS_TASKS", () => {
    expect(jobHasCapability("OPPORTUNITY", "DOCUMENTS_TASKS")).toBe(true);
    expect(jobHasCapability("OPPORTUNITY", "PRODUCE_PANELS")).toBe(false);
    expect(jobHasCapability("OPPORTUNITY", "DELIVER_PANELS")).toBe(false);
    expect(jobHasCapability("OPPORTUNITY", "CLAIMS")).toBe(false);
  });

  it("CONTRACTED should have all capabilities", () => {
    const allCapabilities: JobCapability[] = [
      "DOCUMENTS_TASKS",
      "PRODUCTION_SLOTS",
      "DRAFTING_PROGRAM",
      "START_DRAFTING",
      "PRODUCE_PANELS",
      "DELIVER_PANELS",
      "CLAIMS",
    ];
    for (const cap of allCapabilities) {
      expect(jobHasCapability("CONTRACTED", cap)).toBe(true);
    }
  });

  it("QUOTING should only have DOCUMENTS_TASKS", () => {
    expect(jobHasCapability("QUOTING", "DOCUMENTS_TASKS")).toBe(true);
    expect(jobHasCapability("QUOTING", "PRODUCTION_SLOTS")).toBe(false);
  });

  it("WON_AWAITING_CONTRACT should have drafting but not production", () => {
    expect(jobHasCapability("WON_AWAITING_CONTRACT", "START_DRAFTING")).toBe(true);
    expect(jobHasCapability("WON_AWAITING_CONTRACT", "PRODUCE_PANELS")).toBe(false);
    expect(jobHasCapability("WON_AWAITING_CONTRACT", "CLAIMS")).toBe(false);
  });
});

describe("Status Validation", () => {
  it("should accept valid status for phase", () => {
    expect(isValidStatusForPhase("OPPORTUNITY", "ACTIVE")).toBe(true);
    expect(isValidStatusForPhase("OPPORTUNITY", "ON_HOLD")).toBe(true);
    expect(isValidStatusForPhase("CONTRACTED", "COMPLETED")).toBe(true);
  });

  it("should reject invalid status for phase", () => {
    expect(isValidStatusForPhase("OPPORTUNITY", "COMPLETED")).toBe(false);
    expect(isValidStatusForPhase("OPPORTUNITY", "ARCHIVED")).toBe(false);
    expect(isValidStatusForPhase("LOST", "ACTIVE")).toBe(false);
  });

  it("getDefaultStatusForPhase should return first allowed status", () => {
    expect(getDefaultStatusForPhase("OPPORTUNITY")).toBe("ACTIVE");
    expect(getDefaultStatusForPhase("CONTRACTED")).toBe("ACTIVE");
    expect(getDefaultStatusForPhase("LOST")).toBe("ARCHIVED");
  });
});

describe("Phase Advancement", () => {
  it("should allow forward progression by one step", () => {
    expect(canAdvanceToPhase("OPPORTUNITY", "QUOTING")).toBe(true);
    expect(canAdvanceToPhase("QUOTING", "WON_AWAITING_CONTRACT")).toBe(true);
    expect(canAdvanceToPhase("WON_AWAITING_CONTRACT", "CONTRACTED")).toBe(true);
  });

  it("should allow backward progression by one step", () => {
    expect(canAdvanceToPhase("QUOTING", "OPPORTUNITY")).toBe(true);
    expect(canAdvanceToPhase("WON_AWAITING_CONTRACT", "QUOTING")).toBe(true);
  });

  it("should allow staying in same phase", () => {
    expect(canAdvanceToPhase("OPPORTUNITY", "OPPORTUNITY")).toBe(true);
    expect(canAdvanceToPhase("CONTRACTED", "CONTRACTED")).toBe(true);
  });

  it("should block skipping phases (e.g., OPPORTUNITY -> CONTRACTED)", () => {
    expect(canAdvanceToPhase("OPPORTUNITY", "CONTRACTED")).toBe(false);
    expect(canAdvanceToPhase("OPPORTUNITY", "WON_AWAITING_CONTRACT")).toBe(false);
  });

  it("should always allow transition to LOST", () => {
    for (const phase of JOB_PHASES) {
      expect(canAdvanceToPhase(phase, "LOST")).toBe(true);
    }
  });

  it("should block transitions FROM LOST (except to LOST itself)", () => {
    expect(canAdvanceToPhase("LOST", "OPPORTUNITY")).toBe(false);
    expect(canAdvanceToPhase("LOST", "CONTRACTED")).toBe(false);
    expect(canAdvanceToPhase("LOST", "LOST")).toBe(true);
  });
});

describe("Labels", () => {
  it("should return human-readable phase labels", () => {
    expect(getPhaseLabel("OPPORTUNITY")).toBe("Opportunity");
    expect(getPhaseLabel("WON_AWAITING_CONTRACT")).toBe("Won Awaiting Contract");
    expect(getPhaseLabel("CONTRACTED")).toBe("Contracted");
  });

  it("should handle unknown phases gracefully", () => {
    const result = getPhaseLabel("UNKNOWN_PHASE");
    expect(result.toLowerCase()).toBe("unknown phase");
  });

  it("should return human-readable status labels", () => {
    expect(getStatusLabel("ACTIVE")).toBe("Active");
    expect(getStatusLabel("ON_HOLD")).toBe("On Hold");
    expect(getStatusLabel("PENDING_START")).toBe("Pending Start");
  });

  it("should handle unknown statuses gracefully", () => {
    expect(getStatusLabel("UNKNOWN_STATUS").toLowerCase()).toBe("unknown status");
  });
});

describe("Dropdown Visibility", () => {
  it("should show non-LOST phases in dropdowns", () => {
    expect(isJobVisibleInDropdowns("OPPORTUNITY")).toBe(true);
    expect(isJobVisibleInDropdowns("QUOTING")).toBe(true);
    expect(isJobVisibleInDropdowns("CONTRACTED")).toBe(true);
  });

  it("should hide LOST phase from dropdowns", () => {
    expect(isJobVisibleInDropdowns("LOST")).toBe(false);
  });
});

describe("Legacy Status Migration", () => {
  it("should map old OPPORTUNITY status", () => {
    expect(mapOldStatusToPhaseAndStatus("OPPORTUNITY")).toEqual({
      phase: "OPPORTUNITY",
      status: "ON_HOLD",
    });
  });

  it("should map old WON status", () => {
    expect(mapOldStatusToPhaseAndStatus("WON")).toEqual({
      phase: "WON_AWAITING_CONTRACT",
      status: "PENDING_START",
    });
  });

  it("should map old IN_PROGRESS to CONTRACTED/STARTED", () => {
    expect(mapOldStatusToPhaseAndStatus("IN_PROGRESS")).toEqual({
      phase: "CONTRACTED",
      status: "STARTED",
    });
  });

  it("should map LOST/CANCELLED to LOST with null status", () => {
    expect(mapOldStatusToPhaseAndStatus("LOST")).toEqual({
      phase: "LOST",
      status: null,
    });
    expect(mapOldStatusToPhaseAndStatus("CANCELLED")).toEqual({
      phase: "LOST",
      status: null,
    });
  });

  it("should default unknown statuses to OPPORTUNITY/ON_HOLD", () => {
    expect(mapOldStatusToPhaseAndStatus("SOMETHING_RANDOM")).toEqual({
      phase: "OPPORTUNITY",
      status: "ON_HOLD",
    });
  });
});
