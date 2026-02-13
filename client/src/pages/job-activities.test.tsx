import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import JobActivitiesPage from "./job-activities";

vi.mock("wouter", () => ({
  useLocation: () => ["/jobs/1/activities", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({}),
  useRoute: () => [true, { jobId: "1" }],
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Test User", email: "test@test.com", role: "admin" },
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-document-title", () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock("@/components/help/page-help-button", () => ({
  PageHelpButton: () => null,
}));

vi.mock("@/lib/stage-colors", () => ({
  getStageColor: () => ({ bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-300" }),
}));

vi.mock("@/pages/tasks/ActivityTasksPanel", () => ({
  ActivityTasksPanel: () => null,
}));

vi.mock("@/pages/job-activities-gantt", () => ({
  GanttChart: () => null,
}));

vi.mock("@/pages/job-activities-progress", () => ({
  ProgressFlowChart: () => null,
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("JobActivitiesPage", () => {
  it("shows loading state with aria-busy", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<JobActivitiesPage />);
    const busyContainer = document.querySelector("[aria-busy='true']");
    expect(busyContainer).toBeInTheDocument();
  });

  it("renders with role main and aria-label Job Activities", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<JobActivitiesPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Job Activities");
  });

  it("renders page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<JobActivitiesPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Project Activities");
  });

  it("has accessible attributes", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<JobActivitiesPage />);
    expect(screen.getByTestId("button-back-to-tasks")).toBeInTheDocument();
  });
});
