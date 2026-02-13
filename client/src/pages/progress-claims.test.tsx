import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ProgressClaimsPage from "./progress-claims";

vi.mock("wouter", () => ({
  useLocation: () => ["/progress-claims", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Admin User", email: "admin@test.com", role: "admin" },
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

let mockIsLoading = false;

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: [],
      isLoading: mockIsLoading,
    })),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

describe("ProgressClaimsPage", () => {
  it("renders with role main and aria-label Progress Claims", () => {
    mockIsLoading = false;
    renderWithProviders(<ProgressClaimsPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Progress Claims");
  });

  it("shows search input with aria-label", () => {
    mockIsLoading = false;
    renderWithProviders(<ProgressClaimsPage />);
    const searchInput = screen.getByLabelText("Search claims");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute("data-testid", "input-search");
  });

  it("shows loading state with aria-busy", () => {
    mockIsLoading = true;
    renderWithProviders(<ProgressClaimsPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-busy", "true");
  });

  it("displays page title", () => {
    mockIsLoading = false;
    renderWithProviders(<ProgressClaimsPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Progress Claims");
  });
});
