import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { ProgrammeGanttChart } from "./job-programme-gantt";

vi.mock("wouter", () => ({
  useLocation: () => ["/job-programme-gantt", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ id: "1" }),
  useRoute: () => [true, { id: "1" }],
}));

const mockEntries = [
  {
    id: "entry-1",
    jobId: "job-1",
    buildingNumber: 1,
    level: "L1",
    pourLabel: "A",
    sequenceOrder: 1,
    cycleDays: 7,
    estimatedStartDate: "2025-01-01",
    estimatedEndDate: "2025-01-07",
    manualStartDate: null,
    manualEndDate: null,
    predecessorSequenceOrder: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "entry-2",
    jobId: "job-1",
    buildingNumber: 1,
    level: "L2",
    pourLabel: "A",
    sequenceOrder: 2,
    cycleDays: 7,
    estimatedStartDate: "2025-01-08",
    estimatedEndDate: "2025-01-14",
    manualStartDate: null,
    manualEndDate: null,
    predecessorSequenceOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("ProgrammeGanttChart", () => {
  it("renders the programme gantt chart container", () => {
    renderWithProviders(
      <ProgrammeGanttChart entries={mockEntries as any} jobTitle="Test Job" />
    );
    expect(screen.getByTestId("programme-gantt-chart")).toBeInTheDocument();
  });

  it("renders entry labels", () => {
    renderWithProviders(
      <ProgrammeGanttChart entries={mockEntries as any} jobTitle="Test Job" />
    );
    expect(screen.getByTestId("gantt-label-entry-1")).toBeInTheDocument();
    expect(screen.getByTestId("gantt-label-entry-2")).toBeInTheDocument();
  });

  it("renders zoom controls", () => {
    renderWithProviders(
      <ProgrammeGanttChart entries={mockEntries as any} jobTitle="Test Job" />
    );
    expect(screen.getByTestId("btn-zoom-in")).toBeInTheDocument();
    expect(screen.getByTestId("btn-zoom-out")).toBeInTheDocument();
    expect(screen.getByTestId("btn-scroll-today")).toBeInTheDocument();
  });

  it("renders print button", () => {
    renderWithProviders(
      <ProgrammeGanttChart entries={mockEntries as any} jobTitle="Test Job" />
    );
    expect(screen.getByTestId("btn-print-gantt")).toBeInTheDocument();
  });
});
