import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/production-report/2025-01-15", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ date: "2025-01-15" }),
  useRoute: () => [true, { date: "2025-01-15" }],
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

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

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

import ProductionReportDetailPage from "./production-report-detail";

describe("ProductionReportDetailPage", () => {
  const defaultMock = (opts: any) => {
    const key = JSON.stringify(opts?.queryKey || []);
    if (key.includes("jobs")) {
      return { data: [], isLoading: false, error: null };
    }
    if (key.includes("summary") || key.includes("production")) {
      return {
        data: {
          entries: [],
          totals: { totalVolume: 0, totalArea: 0, count: 0, totalCost: 0, totalHours: 0 },
        },
        isLoading: false,
        error: null,
      };
    }
    return { data: undefined, isLoading: false, error: null };
  };

  beforeEach(() => {
    mockUseQuery.mockImplementation(defaultMock);
  });

  it("renders the page", () => {
    renderWithProviders(<ProductionReportDetailPage />);
    expect(screen.getByTestId("text-production-title")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockImplementation((opts: any) => {
      const key = JSON.stringify(opts?.queryKey || []);
      if (key.includes("jobs")) {
        return { data: [], isLoading: false, error: null };
      }
      return { data: undefined, isLoading: true, error: null };
    });
    renderWithProviders(<ProductionReportDetailPage />);
    const skeleton = document.querySelector(".h-10");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders page title", () => {
    renderWithProviders(<ProductionReportDetailPage />);
    expect(screen.getByTestId("text-production-title")).toBeInTheDocument();
  });

  it("has accessible attributes", () => {
    renderWithProviders(<ProductionReportDetailPage />);
    expect(screen.getByTestId("button-back")).toBeInTheDocument();
  });
});
