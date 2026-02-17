import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ApInvoicesPage from "./ap-invoices";

vi.mock("wouter", () => ({
  useLocation: () => ["/ap-invoices", vi.fn()],
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
          data: { all: 0, imported: 0, processed: 0, confirmed: 0, approved: 0, on_hold: 0, exported: 0, rejected: 0, waiting_on_me: 0, partially_approved: 0, failed_export: 0 },
          isLoading: false,
        };
      }

      if (typeof queryKey === "string" && queryKey.includes("/ap-invoices")) {
        return {
          data: { invoices: [], total: 0, page: 1, limit: 50 },
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

describe("ApInvoicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    renderWithProviders(<ApInvoicesPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Invoices");
  });

  it("renders empty state when no invoices", () => {
    renderWithProviders(<ApInvoicesPage />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders the check emails button", () => {
    renderWithProviders(<ApInvoicesPage />);
    expect(screen.getByTestId("button-check-emails")).toBeInTheDocument();
  });

  it("renders search input", () => {
    renderWithProviders(<ApInvoicesPage />);
    expect(screen.getByTestId("input-search")).toBeInTheDocument();
  });

  it("renders upload button", () => {
    renderWithProviders(<ApInvoicesPage />);
    expect(screen.getByTestId("button-upload-invoices")).toBeInTheDocument();
  });
});
