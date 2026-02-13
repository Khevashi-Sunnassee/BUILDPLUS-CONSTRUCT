import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import LogisticsPage from "./logistics";

vi.mock("wouter", () => ({
  useLocation: () => ["/logistics", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Test User", email: "test@example.com", role: "admin" },
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
  PageHelpButton: () => <span data-testid="page-help-button" />,
}));

let mockLoadListsLoading = true;

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: ({ queryKey }: any) => {
      if (queryKey?.[0]?.includes?.("load-lists") || queryKey?.[0]?.includes?.("logistics")) {
        return { data: mockLoadListsLoading ? undefined : [], isLoading: mockLoadListsLoading, isError: false };
      }
      return { data: undefined, isLoading: false, isError: false };
    },
    useMutation: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    }),
  };
});

describe("LogisticsPage", () => {
  it("shows loading state with aria-busy when load lists are loading", () => {
    mockLoadListsLoading = true;
    renderWithProviders(<LogisticsPage />);
    const busyRegion = document.querySelector("[aria-busy='true']");
    expect(busyRegion).toBeInTheDocument();
  });

  it("renders with role main and aria-label Logistics when loaded", () => {
    mockLoadListsLoading = false;
    renderWithProviders(<LogisticsPage />);
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("aria-label", "Logistics");
  });

  it("shows the factory filter with proper aria-label when loaded", () => {
    mockLoadListsLoading = false;
    renderWithProviders(<LogisticsPage />);
    const factoryFilter = screen.getByTestId("select-factory-filter");
    expect(factoryFilter).toBeInTheDocument();
    expect(factoryFilter).toHaveAttribute("aria-label", "Filter by factory");
  });

  it("shows the page title when loaded", () => {
    mockLoadListsLoading = false;
    renderWithProviders(<LogisticsPage />);
    const title = screen.getByTestId("text-page-title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Logistics");
  });
});
