import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import HelpCenterPage from "./help-center";

vi.mock("wouter", () => ({
  useLocation: () => ["/help-center", vi.fn()],
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

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-document-title", () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock("@/components/help/page-help-button", () => ({
  PageHelpButton: () => null,
}));

vi.mock("@/components/help/help-provider", () => ({
  useHelpContext: () => ({ openDrawer: vi.fn() }),
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

describe("HelpCenterPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders the help center title", () => {
    renderWithProviders(<HelpCenterPage />);
    expect(screen.getByTestId("text-help-center-title")).toHaveTextContent("Help Center");
  });

  it("renders the search input", () => {
    renderWithProviders(<HelpCenterPage />);
    expect(screen.getByTestId("input-help-search")).toBeInTheDocument();
  });

  it("shows recently updated section when no search query", () => {
    renderWithProviders(<HelpCenterPage />);
    expect(screen.getByText("Recently Updated")).toBeInTheDocument();
  });

  it("shows empty state when no articles available", () => {
    renderWithProviders(<HelpCenterPage />);
    expect(screen.getByText("No help articles available yet.")).toBeInTheDocument();
  });
});
