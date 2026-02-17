import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import DraftingEmailsPage from "./drafting-emails";

vi.mock("wouter", () => ({
  useLocation: () => ["/drafting-emails", vi.fn()],
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

      if (typeof queryKey === "string" && queryKey.includes("counts")) {
        return {
          data: { RECEIVED: 0, PROCESSING: 0, PROCESSED: 0, MATCHED: 0, ARCHIVED: 0, FAILED: 0, all: 0 },
          isLoading: false,
        };
      }

      if (typeof queryKey === "string" && queryKey.includes("/drafting-inbox")) {
        return {
          data: { emails: [], total: 0, page: 1, limit: 50 },
          isLoading: false,
        };
      }

      return { data: undefined, isLoading: false };
    }),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  };
});

describe("DraftingEmailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    renderWithProviders(<DraftingEmailsPage />);
    expect(screen.getByTestId("text-drafting-emails-title")).toHaveTextContent("Drafting Emails");
  });

  it("renders the check emails button", () => {
    renderWithProviders(<DraftingEmailsPage />);
    expect(screen.getByTestId("button-check-drafting-emails")).toBeInTheDocument();
  });

  it("renders search input", () => {
    renderWithProviders(<DraftingEmailsPage />);
    expect(screen.getByTestId("input-drafting-search")).toBeInTheDocument();
  });

  it("renders empty state when no emails", () => {
    renderWithProviders(<DraftingEmailsPage />);
    expect(screen.getByTestId("drafting-emails-empty")).toBeInTheDocument();
  });

  it("renders upload button", () => {
    renderWithProviders(<DraftingEmailsPage />);
    expect(screen.getByTestId("button-upload-drafting-docs")).toBeInTheDocument();
  });
});
