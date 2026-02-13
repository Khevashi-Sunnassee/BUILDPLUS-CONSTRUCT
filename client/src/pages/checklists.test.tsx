import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ChecklistsPage from "./checklists";

vi.mock("wouter", () => ({
  useLocation: () => ["/checklists", vi.fn()],
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

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("ChecklistsPage", () => {
  it("shows loading state with aria-busy", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<ChecklistsPage />);
    const busyContainer = document.querySelector("[aria-busy='true']");
    expect(busyContainer).toBeInTheDocument();
  });

  it("renders with role main and aria-label Checklists", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ChecklistsPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Checklists");
  });

  it("shows search input with aria-label", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ChecklistsPage />);
    const searchInput = screen.getByTestId("input-search-checklists");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute("aria-label", "Search checklists");
  });

  it("shows status filter with accessibility attributes", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ChecklistsPage />);
    const statusFilter = screen.getByTestId("select-status-filter");
    expect(statusFilter).toBeInTheDocument();
    expect(statusFilter).toHaveAttribute("aria-label", "Filter by status");
  });
});
