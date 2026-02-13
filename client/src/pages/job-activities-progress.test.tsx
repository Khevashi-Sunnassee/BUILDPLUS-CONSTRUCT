import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { ProgressFlowChart } from "./job-activities-progress";

vi.mock("wouter", () => ({
  useLocation: () => ["/job-activities-progress", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ id: "1" }),
  useRoute: () => [true, { id: "1" }],
}));

const mockActivities = [
  {
    id: "act-1",
    jobId: "job-1",
    name: "Design Phase",
    status: "DONE",
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
    name: "Build Phase",
    status: "IN_PROGRESS",
    sortOrder: 2,
    stageId: "stage-2",
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
  { id: "stage-1", jobId: "job-1", name: "Design", sortOrder: 1, color: null, createdAt: new Date().toISOString() },
  { id: "stage-2", jobId: "job-1", name: "Build", sortOrder: 2, color: null, createdAt: new Date().toISOString() },
];

const mockStageColorMap = new Map([["stage-1", 0], ["stage-2", 1]]);

describe("ProgressFlowChart", () => {
  it("renders the progress flow chart", () => {
    renderWithProviders(
      <ProgressFlowChart
        activities={mockActivities as any}
        stages={mockStages as any}
        stageColorMap={mockStageColorMap}
        onSelectActivity={vi.fn()}
        jobTitle="Test Job"
      />
    );
    expect(screen.getByTestId("progress-flow-chart")).toBeInTheDocument();
  });

  it("renders stage cards", () => {
    renderWithProviders(
      <ProgressFlowChart
        activities={mockActivities as any}
        stages={mockStages as any}
        stageColorMap={mockStageColorMap}
        onSelectActivity={vi.fn()}
        jobTitle="Test Job"
      />
    );
    expect(screen.getByTestId("card-stage-stage-1")).toBeInTheDocument();
    expect(screen.getByTestId("card-stage-stage-2")).toBeInTheDocument();
  });

  it("shows no activities message when empty", () => {
    renderWithProviders(
      <ProgressFlowChart
        activities={[]}
        stages={[]}
        stageColorMap={new Map()}
        onSelectActivity={vi.fn()}
        jobTitle="Test Job"
      />
    );
    expect(screen.getByTestId("text-no-activities")).toHaveTextContent("No activities to display");
  });

  it("renders print button", () => {
    renderWithProviders(
      <ProgressFlowChart
        activities={mockActivities as any}
        stages={mockStages as any}
        stageColorMap={mockStageColorMap}
        onSelectActivity={vi.fn()}
        jobTitle="Test Job"
      />
    );
    expect(screen.getByTestId("button-print-progress")).toBeInTheDocument();
  });
});
