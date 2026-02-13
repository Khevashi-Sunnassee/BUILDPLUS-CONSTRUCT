import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import CapexRequestsPage from "./capex-requests";

vi.mock("wouter", () => ({
  useLocation: () => ["/capex-requests", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({}),
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

describe("CapexRequestsPage", () => {
  it("renders with role main and aria-label", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<CapexRequestsPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "CAPEX Requests");
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<CapexRequestsPage />);
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<CapexRequestsPage />);
    expect(screen.getByTestId("text-capex-page-title")).toHaveTextContent("CAPEX Requests");
  });

  it("has new capex button", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<CapexRequestsPage />);
    expect(screen.getByTestId("button-new-capex")).toBeInTheDocument();
  });

  it("has search input", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<CapexRequestsPage />);
    expect(screen.getByTestId("input-search-capex")).toBeInTheDocument();
  });
});
