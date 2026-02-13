import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import JobTendersPage from "./job-tenders";

vi.mock("wouter", () => ({
  useLocation: () => ["/jobs/1/tenders", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({}),
  useRoute: () => [true, { id: "1" }],
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

describe("JobTendersPage", () => {
  function mockLoaded() {
    mockUseQuery.mockImplementation(({ queryKey }: any) => {
      const key = Array.isArray(queryKey) ? queryKey : [];
      if (key.includes("sheet")) {
        return { data: undefined, isLoading: false, error: null };
      }
      if (key.length === 2 && key[0] === "/api/jobs" && !key.includes("tenders")) {
        return { data: { id: "1", name: "Test Job", jobNumber: "J001" }, isLoading: false, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });
  }

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<JobTendersPage />);
    expect(screen.getByTestId("loading-tender-page")).toBeInTheDocument();
  });

  it("renders with role main and aria-label Job Tenders", () => {
    mockLoaded();
    renderWithProviders(<JobTendersPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Job Tenders");
  });

  it("renders page title", () => {
    mockLoaded();
    renderWithProviders(<JobTendersPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Job Tender Sheets");
  });

  it("has accessible data-testid attributes", () => {
    mockLoaded();
    renderWithProviders(<JobTendersPage />);
    expect(screen.getByTestId("button-back-to-budget")).toBeInTheDocument();
  });
});
