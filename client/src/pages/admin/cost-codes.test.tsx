import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import CostCodesPage from "./cost-codes";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/cost-codes", vi.fn()],
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

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("CostCodesPage", () => {
  it("shows page container", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<CostCodesPage />);
    expect(screen.getByTestId("admin-cost-codes-page")).toBeInTheDocument();
  });

  it("shows page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<CostCodesPage />);
    expect(screen.getByTestId("text-page-title")).toBeInTheDocument();
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Cost Codes");
  });

  it("shows add cost code button", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<CostCodesPage />);
    expect(screen.getByTestId("button-add-cost-code")).toBeInTheDocument();
  });

  it("shows tabs", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<CostCodesPage />);
    expect(screen.getByTestId("tab-codes")).toBeInTheDocument();
    expect(screen.getByTestId("tab-defaults")).toBeInTheDocument();
  });

  it("shows search input", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<CostCodesPage />);
    expect(screen.getByTestId("input-search-cost-codes")).toBeInTheDocument();
  });
});
