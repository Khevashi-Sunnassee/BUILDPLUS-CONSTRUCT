import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/checklist-reports", vi.fn()],
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

import ChecklistReportsPage from "./checklist-reports";

describe("ChecklistReportsPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
  });

  it("renders the page", () => {
    renderWithProviders(<ChecklistReportsPage />);
    expect(screen.getByTestId("page-checklist-reports")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<ChecklistReportsPage />);
    const container = document.querySelector(".space-y-6");
    expect(container).toBeInTheDocument();
  });

  it("renders page filters", () => {
    renderWithProviders(<ChecklistReportsPage />);
    expect(screen.getByTestId("select-status-filter")).toBeInTheDocument();
  });

  it("has accessible attributes", () => {
    renderWithProviders(<ChecklistReportsPage />);
    expect(screen.getByTestId("page-checklist-reports")).toBeInTheDocument();
    expect(screen.getByTestId("button-export-csv")).toBeInTheDocument();
  });
});
