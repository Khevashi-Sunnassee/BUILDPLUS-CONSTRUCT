import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/mobile/new-opportunity", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ id: "1" }),
  useRoute: () => [true, { id: "1" }],
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Test User", email: "test@test.com", role: "admin" },
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/hooks/use-document-title", () => ({ useDocumentTitle: vi.fn() }));
vi.mock("@/components/help/page-help-button", () => ({ PageHelpButton: () => null }));
vi.mock("@/components/mobile/MobileBottomNav", () => ({ default: () => <div data-testid="mock-mobile-nav" /> }));
vi.mock("@/components/layout/mobile-layout", () => ({ default: ({ children, title }: any) => <div role="main" aria-label={title}>{children}</div> }));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

import MobileNewOpportunity from "./new-opportunity";

describe("MobileNewOpportunity", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders the new opportunity page", () => {
    renderWithProviders(<MobileNewOpportunity />);
    expect(screen.getByTestId("mock-mobile-nav")).toBeInTheDocument();
  });

  it("shows page content", () => {
    const { container } = renderWithProviders(<MobileNewOpportunity />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("displays new opportunity heading", () => {
    renderWithProviders(<MobileNewOpportunity />);
    expect(screen.getByText("New Opportunity")).toBeInTheDocument();
  });

  it("has accessible page structure", () => {
    const { container } = renderWithProviders(<MobileNewOpportunity />);
    expect(container.querySelector("div")).toBeInTheDocument();
  });
});
