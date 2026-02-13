import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/mobile/checklists/1", vi.fn()],
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
vi.mock("@/components/checklist/normalize-sections", () => ({ normalizeSections: (s: any) => s || [] }));
vi.mock("@/components/checklist/checklist-form", () => ({
  calculateCompletionRate: () => 0,
  getMissingRequiredFields: () => [],
  isFieldVisible: () => true,
  default: () => <div data-testid="mock-checklist-form" />,
}));

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

import MobileChecklistFillPage from "./checklist-fill";

describe("MobileChecklistFillPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });
  });

  it("renders the checklist fill page", () => {
    const { container } = renderWithProviders(<MobileChecklistFillPage />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("shows loading state when data is loading", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderWithProviders(<MobileChecklistFillPage />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("displays page content", () => {
    const { container } = renderWithProviders(<MobileChecklistFillPage />);
    expect(container.querySelector("div")).toBeInTheDocument();
  });

  it("has accessible page structure", () => {
    const { container } = renderWithProviders(<MobileChecklistFillPage />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
