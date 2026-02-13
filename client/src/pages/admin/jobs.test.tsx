import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import JobsPage from "./jobs";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/jobs", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useRoute: () => [false, {}],
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

vi.mock("./jobs/EstimateImportDialog", () => ({
  EstimateImportDialog: () => null,
}));

vi.mock("./jobs/JobFormDialog", () => ({
  JobFormDialog: () => null,
}));

vi.mock("./jobs/JobImportDialog", () => ({
  JobImportDialog: () => null,
}));

vi.mock("./jobs/JobConfirmationDialogs", () => ({
  DeleteJobDialog: () => null,
  CycleTimesConfirmDialog: () => null,
  LevelChangeConfirmDialog: () => null,
  DaysInAdvanceConfirmDialog: () => null,
  QuickAddCustomerDialog: () => null,
}));

vi.mock("./jobs/AuditLogPanel", () => ({
  AuditLogPanel: () => null,
}));

vi.mock("./jobs/CostOverridesDialog", () => ({
  CostOverridesDialog: () => null,
}));

vi.mock("./jobs/JobMembersPanel", () => ({
  JobMembersPanel: () => null,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("JobsPage", () => {
  it("shows loading state with aria-busy", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<JobsPage />);
    const busyContainer = document.querySelector("[aria-busy='true']");
    expect(busyContainer).toBeInTheDocument();
  });

  it("renders with role main and aria-label Jobs Management", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<JobsPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Jobs Management");
  });

  it("shows page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<JobsPage />);
    expect(screen.getByTestId("text-jobs-title")).toBeInTheDocument();
    expect(screen.getByTestId("text-jobs-title")).toHaveTextContent("Jobs");
  });

  it("shows search input", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<JobsPage />);
    expect(screen.getByTestId("input-search-jobs")).toBeInTheDocument();
  });
});
