import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ItemsPage from "./items";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/items", vi.fn()],
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

describe("ItemsPage", () => {
  it("shows loading skeleton when data is loading", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<ItemsPage />);
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ItemsPage />);
    expect(screen.getByTestId("text-items-title")).toBeInTheDocument();
    expect(screen.getByTestId("text-items-title")).toHaveTextContent("Item Catalog");
  });

  it("shows tabs for categories and items", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ItemsPage />);
    expect(screen.getByTestId("tab-categories")).toBeInTheDocument();
    expect(screen.getByTestId("tab-items")).toBeInTheDocument();
  });

  it("shows create category button", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ItemsPage />);
    expect(screen.getByTestId("button-create-category")).toBeInTheDocument();
  });
});
