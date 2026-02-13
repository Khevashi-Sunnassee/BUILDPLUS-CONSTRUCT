import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/daily-reports/1", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ id: "1" }),
  useRoute: () => [true, { id: "1" }],
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Test User", email: "test@test.com", role: "admin" },
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-document-title", () => ({ useDocumentTitle: vi.fn() }));
vi.mock("@/components/help/page-help-button", () => ({ PageHelpButton: () => null }));

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

import DailyReportDetailPage from "./daily-report-detail";

describe("DailyReportDetailPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        id: "1",
        logDay: "2025-01-15",
        date: "2025-01-15",
        factory: "Factory A",
        factoryId: "f1",
        status: "draft",
        entries: [],
        submittedBy: null,
      },
      isLoading: false,
      error: null,
    });
  });

  it("renders the page", () => {
    renderWithProviders(<DailyReportDetailPage />);
    expect(screen.getByTestId("text-log-date")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<DailyReportDetailPage />);
    const skeleton = document.querySelector(".h-8");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders log date heading", () => {
    renderWithProviders(<DailyReportDetailPage />);
    expect(screen.getByTestId("text-log-date")).toBeInTheDocument();
  });

  it("has accessible attributes", () => {
    renderWithProviders(<DailyReportDetailPage />);
    expect(screen.getByTestId("button-back")).toBeInTheDocument();
    expect(screen.getByTestId("button-export-pdf")).toBeInTheDocument();
  });
});
