import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import TenderEmailsPage from "./tender-emails";

vi.mock("wouter", () => ({
  useLocation: () => ["/tender-emails", vi.fn()],
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

      if (typeof queryKey === "string" && queryKey.includes("/tender-inbox")) {
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

describe("TenderEmailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    renderWithProviders(<TenderEmailsPage />);
    expect(screen.getByTestId("text-tender-emails-title")).toHaveTextContent("Tender Emails");
  });

  it("renders the check emails button", () => {
    renderWithProviders(<TenderEmailsPage />);
    expect(screen.getByTestId("button-check-tender-emails")).toBeInTheDocument();
  });

  it("renders search input", () => {
    renderWithProviders(<TenderEmailsPage />);
    expect(screen.getByTestId("input-tender-search")).toBeInTheDocument();
  });

  it("renders empty state when no emails", () => {
    renderWithProviders(<TenderEmailsPage />);
    expect(screen.getByTestId("tender-emails-empty")).toBeInTheDocument();
  });

  it("renders upload button", () => {
    renderWithProviders(<TenderEmailsPage />);
    expect(screen.getByTestId("button-upload-tender-docs")).toBeInTheDocument();
  });
});
