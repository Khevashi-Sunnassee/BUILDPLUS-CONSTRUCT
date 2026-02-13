import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/item-categories", vi.fn()],
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

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-document-title", () => ({ useDocumentTitle: vi.fn() }));
vi.mock("@/components/help/page-help-button", () => ({ PageHelpButton: () => null }));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

import AdminItemCategoriesPage from "./item-categories";

describe("AdminItemCategoriesPage", () => {
  it("renders the page", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<AdminItemCategoriesPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<AdminItemCategoriesPage />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });

  it("renders page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<AdminItemCategoriesPage />);
    expect(screen.getByTestId("text-item-categories-title")).toHaveTextContent("Item Categories");
  });

  it("has accessible attributes", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<AdminItemCategoriesPage />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-label", "Item Categories");
    expect(screen.getByTestId("button-create-category")).toBeInTheDocument();
  });
});
