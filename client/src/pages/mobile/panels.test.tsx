import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import MobilePanelsPage from "./panels";

vi.mock("wouter", () => ({
  useLocation: () => ["/mobile/panels", vi.fn()],
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

vi.mock("@/components/mobile/MobileBottomNav", () => ({
  default: () => <nav data-testid="mobile-bottom-nav">Bottom Nav</nav>,
}));

let mockQueryReturn = { data: undefined, isLoading: true };

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => mockQueryReturn,
  };
});

describe("MobilePanelsPage", () => {
  it("renders the panels title", () => {
    mockQueryReturn = { data: [], isLoading: false } as any;
    renderWithProviders(<MobilePanelsPage />);
    const title = screen.getByTestId("text-panels-title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Panel Register");
  });

  it("shows loading state with skeleton placeholders", () => {
    mockQueryReturn = { data: undefined, isLoading: true };
    renderWithProviders(<MobilePanelsPage />);
    const skeletons = document.querySelectorAll("[class*='animate-pulse'], [data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no panels exist", () => {
    mockQueryReturn = { data: [], isLoading: false } as any;
    renderWithProviders(<MobilePanelsPage />);
    expect(screen.getByText("No panels yet")).toBeInTheDocument();
    expect(screen.getByText("Panels will appear here")).toBeInTheDocument();
  });

  it("renders the bottom navigation", () => {
    mockQueryReturn = { data: [], isLoading: false } as any;
    renderWithProviders(<MobilePanelsPage />);
    expect(screen.getByTestId("mobile-bottom-nav")).toBeInTheDocument();
  });
});
