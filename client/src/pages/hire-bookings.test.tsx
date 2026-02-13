import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import HireBookingsPage from "./hire-bookings";

vi.mock("wouter", () => ({
  useLocation: () => ["/hire-bookings", vi.fn()],
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

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
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

describe("HireBookingsPage", () => {
  it("shows loading state with aria-busy", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<HireBookingsPage />);
    const busyContainer = document.querySelector("[aria-busy='true']");
    expect(busyContainer).toBeInTheDocument();
  });

  it("renders with role main and aria-label Hire Bookings", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<HireBookingsPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Hire Bookings");
  });

  it("shows search input with aria-label", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<HireBookingsPage />);
    const searchInput = screen.getByTestId("input-search-hire");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute("aria-label", "Search hire bookings");
  });

  it("shows category and equipment filters with accessibility attributes", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<HireBookingsPage />);
    const categoryFilter = screen.getByTestId("select-category-filter");
    expect(categoryFilter).toHaveAttribute("aria-label", "Filter by category");
    const equipmentFilter = screen.getByTestId("select-equipment-filter");
    expect(equipmentFilter).toHaveAttribute("aria-label", "Filter by equipment");
  });
});
