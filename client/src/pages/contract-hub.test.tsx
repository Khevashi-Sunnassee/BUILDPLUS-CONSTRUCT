import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ContractHubPage from "./contract-hub";

vi.mock("wouter", () => ({
  useLocation: () => ["/contracts", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
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
  PageHelpButton: () => <div data-testid="mock-help-button" />,
}));

vi.mock("dompurify", () => ({
  default: { sanitize: (html: string) => html },
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

describe("ContractHubPage", () => {
  it("shows loading state with aria-busy", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<ContractHubPage />);
    const busyContainer = document.querySelector("[aria-busy='true']");
    expect(busyContainer).toBeInTheDocument();
  });

  it("renders with role main and aria-label Contract Hub", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ContractHubPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Contract Hub");
  });

  it("shows search input with aria-label", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ContractHubPage />);
    const searchInput = screen.getByTestId("input-search-contracts");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute("aria-label", "Search contracts");
  });

  it("shows filter inputs with accessibility attributes", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ContractHubPage />);
    const statusFilter = screen.getByTestId("select-contract-status-filter");
    expect(statusFilter).toHaveAttribute("aria-label", "Filter by contract status");
    const workStatusFilter = screen.getByTestId("select-work-status-filter");
    expect(workStatusFilter).toHaveAttribute("aria-label", "Filter by work status");
  });
});
