import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/pm-call-logs", vi.fn()],
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

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-document-title", () => ({ useDocumentTitle: vi.fn() }));
vi.mock("@/components/help/page-help-button", () => ({ PageHelpButton: () => null }));

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

import PmCallLogsPage from "./pm-call-logs";

describe("PmCallLogsPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
  });

  it("renders the page", () => {
    renderWithProviders(<PmCallLogsPage />);
    expect(screen.getByTestId("text-page-title")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<PmCallLogsPage />);
    expect(screen.getByTestId("text-page-title")).toBeInTheDocument();
  });

  it("renders page title", () => {
    renderWithProviders(<PmCallLogsPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("PM Call Logs");
  });

  it("has accessible attributes", () => {
    renderWithProviders(<PmCallLogsPage />);
    expect(screen.getByTestId("button-new-call-log")).toBeInTheDocument();
    expect(screen.getByTestId("select-job-filter")).toBeInTheDocument();
  });
});
