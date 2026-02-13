import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import MobileJobsPage from "./jobs";

vi.mock("wouter", () => ({
  useLocation: () => ["/mobile/jobs", vi.fn()],
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

describe("MobileJobsPage", () => {
  it("renders the jobs title", () => {
    mockQueryReturn = { data: [], isLoading: false } as any;
    renderWithProviders(<MobileJobsPage />);
    const title = screen.getByTestId("text-jobs-title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Jobs");
  });

  it("shows loading state with skeleton placeholders", () => {
    mockQueryReturn = { data: undefined, isLoading: true };
    renderWithProviders(<MobileJobsPage />);
    const skeletons = document.querySelectorAll("[class*='animate-pulse'], [data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no jobs exist", () => {
    mockQueryReturn = { data: [], isLoading: false } as any;
    renderWithProviders(<MobileJobsPage />);
    expect(screen.getByText("No jobs yet")).toBeInTheDocument();
    expect(screen.getByText("Jobs will appear here")).toBeInTheDocument();
  });

  it("renders the bottom navigation", () => {
    mockQueryReturn = { data: [], isLoading: false } as any;
    renderWithProviders(<MobileJobsPage />);
    expect(screen.getByTestId("mobile-bottom-nav")).toBeInTheDocument();
  });
});
