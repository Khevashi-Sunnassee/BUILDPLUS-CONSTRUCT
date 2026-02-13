import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/mobile/pm-call-logs", vi.fn()],
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

import MobilePmCallLogsPage from "./pm-call-logs";

describe("MobilePmCallLogsPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders the PM call logs page", () => {
    renderWithProviders(<MobilePmCallLogsPage />);
    expect(screen.getByTestId("mock-mobile-nav")).toBeInTheDocument();
  });

  it("displays PM call logs heading", () => {
    renderWithProviders(<MobilePmCallLogsPage />);
    expect(screen.getByTestId("text-call-logs-title")).toBeInTheDocument();
    expect(screen.getByText("PM Call Logs")).toBeInTheDocument();
  });

  it("shows empty state when no logs", () => {
    renderWithProviders(<MobilePmCallLogsPage />);
    expect(screen.getByText(/no call logs/i)).toBeInTheDocument();
  });

  it("has accessible page structure", () => {
    const { container } = renderWithProviders(<MobilePmCallLogsPage />);
    expect(container.querySelector("div")).toBeInTheDocument();
  });
});
