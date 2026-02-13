import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import MobileDashboard from "./dashboard";

vi.mock("wouter", () => ({
  useLocation: () => ["/mobile/dashboard", vi.fn()],
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
  useIsMobile: () => true,
}));

vi.mock("@/hooks/use-document-title", () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock("@/hooks/use-mobile-permissions", () => ({
  useMobilePermissions: () => ({
    isHidden: () => false,
  }),
}));

vi.mock("@/components/mobile/MobileBottomNav", () => ({
  default: () => <nav data-testid="mobile-bottom-nav">Bottom Nav</nav>,
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({ data: undefined, isLoading: true }),
  };
});

describe("MobileDashboard", () => {
  it("renders main dashboard container with correct role and aria-label", () => {
    renderWithProviders(<MobileDashboard />);
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("aria-label", "Mobile Dashboard");
  });

  it("renders the search button in the header", () => {
    renderWithProviders(<MobileDashboard />);
    const searchButton = screen.getByTestId("button-search");
    expect(searchButton).toBeInTheDocument();
    expect(searchButton).toHaveAttribute("aria-label", "Search");
  });

  it("shows loading state with skeleton stats", () => {
    renderWithProviders(<MobileDashboard />);
    const skeletonStats = screen.getByTestId("skeleton-stats");
    expect(skeletonStats).toBeInTheDocument();
    expect(skeletonStats).toHaveAttribute("aria-label", "Loading statistics");
  });

  it("shows aria-busy on the content area while loading", () => {
    renderWithProviders(<MobileDashboard />);
    const busyRegion = document.querySelector("[aria-busy]");
    expect(busyRegion).toBeInTheDocument();
    expect(busyRegion).toHaveAttribute("aria-busy", "true");
  });

  it("renders the quick access navigation", () => {
    renderWithProviders(<MobileDashboard />);
    const nav = screen.getByRole("navigation", { name: "Quick access" });
    expect(nav).toBeInTheDocument();
  });
});
