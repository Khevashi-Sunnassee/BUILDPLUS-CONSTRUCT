import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import SalesPipelinePage from "./sales-pipeline";

vi.mock("wouter", () => ({
  useLocation: () => ["/sales-pipeline", vi.fn()],
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

describe("SalesPipelinePage", () => {
  it("renders with role main and aria-label Sales Pipeline", () => {
    mockIsLoading = false;
    renderWithProviders(<SalesPipelinePage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Sales Pipeline");
  });

  it("shows search input with aria-label", () => {
    mockIsLoading = false;
    renderWithProviders(<SalesPipelinePage />);
    const searchInput = screen.getByLabelText("Search pipeline");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute("data-testid", "input-search-pipeline");
  });

  it("shows loading state with aria-busy", () => {
    mockIsLoading = true;
    renderWithProviders(<SalesPipelinePage />);
    const busyElement = document.querySelector("[aria-busy='true']");
    expect(busyElement).toBeInTheDocument();
  });

  it("shows live region stats", () => {
    mockIsLoading = false;
    renderWithProviders(<SalesPipelinePage />);
    const totalPipeline = screen.getByTestId("text-total-pipeline");
    expect(totalPipeline).toHaveAttribute("aria-live", "polite");
    const weightedValue = screen.getByTestId("text-weighted-value");
    expect(weightedValue).toHaveAttribute("aria-live", "polite");
    const activeCount = screen.getByTestId("text-active-count");
    expect(activeCount).toHaveAttribute("aria-live", "polite");
  });
});
