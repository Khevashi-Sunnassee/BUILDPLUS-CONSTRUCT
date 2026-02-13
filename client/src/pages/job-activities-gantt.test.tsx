import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { GanttChart } from "./job-activities-gantt";

vi.mock("wouter", () => ({
  useLocation: () => ["/job-activities-gantt", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ id: "1" }),
  useRoute: () => [true, { id: "1" }],
}));

const mockActivities = [
  {
    id: "act-1",
    jobId: "job-1",
    name: "Activity 1",
    status: "IN_PROGRESS",
    sortOrder: 1,
    stageId: "stage-1",
    parentId: null,
    startDate: "2025-01-01",
    endDate: "2025-01-15",
    estimatedDays: 14,
    predecessorSortOrder: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "act-2",
    jobId: "job-1",
    name: "Activity 2",
    status: "NOT_STARTED",
    sortOrder: 2,
    stageId: "stage-1",
    parentId: null,
    startDate: "2025-01-16",
    endDate: "2025-01-30",
    estimatedDays: 14,
    predecessorSortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockStages = [
  { id: "stage-1", jobId: "job-1", name: "Phase 1", sortOrder: 1, color: null, createdAt: new Date().toISOString() },
];

const mockStageColorMap = new Map([["stage-1", 0]]);

describe("GanttChart", () => {
  it("renders the gantt chart container", () => {
    renderWithProviders(
      <GanttChart
        activities={mockActivities as any}
        stages={mockStages as any}
        stageColorMap={mockStageColorMap}
        onSelectActivity={vi.fn()}
        jobTitle="Test Job"
      />
    );
    expect(screen.getByTestId("gantt-chart")).toBeInTheDocument();
  });

  it("renders activity labels", () => {
    renderWithProviders(
      <GanttChart
        activities={mockActivities as any}
        stages={mockStages as any}
        stageColorMap={mockStageColorMap}
        onSelectActivity={vi.fn()}
        jobTitle="Test Job"
      />
    );
    expect(screen.getByTestId("gantt-label-act-1")).toBeInTheDocument();
    expect(screen.getByTestId("gantt-label-act-2")).toBeInTheDocument();
  });

  it("renders zoom and print controls", () => {
    renderWithProviders(
      <GanttChart
        activities={mockActivities as any}
        stages={mockStages as any}
        stageColorMap={mockStageColorMap}
        onSelectActivity={vi.fn()}
        jobTitle="Test Job"
      />
    );
    expect(screen.getByTestId("button-gantt-zoom-in")).toBeInTheDocument();
    expect(screen.getByTestId("button-gantt-zoom-out")).toBeInTheDocument();
    expect(screen.getByTestId("button-gantt-today")).toBeInTheDocument();
    expect(screen.getByTestId("button-gantt-print")).toBeInTheDocument();
  });
});
