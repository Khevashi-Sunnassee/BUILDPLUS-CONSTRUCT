import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ScopeOfWorksPage from "./scope-of-works";

vi.mock("wouter", () => ({
  useLocation: () => ["/scope-of-works", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
    },
    logout: vi.fn(),
  })),
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

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn((options: any) => {
      const queryKey = Array.isArray(options.queryKey) ? options.queryKey[0] : options.queryKey;

      if (queryKey === "/api/scopes") {
        return {
          data: [
            {
              id: "scope1",
              name: "Electrical Scope",
              tradeId: "trade1",
              jobTypeId: null,
              status: "ACTIVE",
              description: "Electrical installation scope",
              source: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              trade: { id: "trade1", name: "Electrical" },
              jobType: null,
              itemCount: 5,
            },
          ],
          isLoading: false,
        };
      }

      if (queryKey === "/api/scopes/stats") {
        return {
          data: { total: 1, active: 1, draft: 0, trades: 1 },
          isLoading: false,
        };
      }

      if (queryKey === "/api/scope-trades") {
        return { data: [{ id: "trade1", name: "Electrical" }], isLoading: false };
      }

      if (queryKey === "/api/job-types") {
        return { data: [], isLoading: false };
      }

      return { data: undefined, isLoading: false };
    }),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  };
});

describe("ScopeOfWorksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    renderWithProviders(<ScopeOfWorksPage />);
    expect(screen.getByTestId("text-scope-of-works-title")).toBeInTheDocument();
    expect(screen.getByTestId("text-scope-of-works-title")).toHaveTextContent("Scope of Works");
  });

  it("renders the create button", () => {
    renderWithProviders(<ScopeOfWorksPage />);
    expect(screen.getByTestId("button-add-scope")).toBeInTheDocument();
  });

  it("renders search input", () => {
    renderWithProviders(<ScopeOfWorksPage />);
    expect(screen.getByTestId("input-search-scopes")).toBeInTheDocument();
  });

  it("displays scope items in the list", () => {
    renderWithProviders(<ScopeOfWorksPage />);
    expect(screen.getByText("Electrical Scope")).toBeInTheDocument();
  });

  it("displays scope status badge", () => {
    renderWithProviders(<ScopeOfWorksPage />);
    expect(screen.getByTestId("badge-status-ACTIVE")).toBeInTheDocument();
  });
});
