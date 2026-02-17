import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ApApprovalRulesPage from "./ap-approval-rules";

vi.mock("wouter", () => ({
  useLocation: () => ["/ap-invoices/approval-rules", vi.fn()],
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

      if (typeof queryKey === "string" && queryKey.includes("/ap-approval-rules")) {
        return {
          data: [
            {
              id: "rule-1",
              companyId: "c1",
              name: "High Value Approval",
              description: "Requires approval for invoices over $5000",
              ruleType: "USER",
              isActive: true,
              priority: 1,
              conditions: [{ field: "AMOUNT", operator: "GREATER_THAN", values: ["5000"] }],
              approverUserIds: ["u1"],
              autoApprove: false,
              createdAt: "2025-01-01T00:00:00Z",
              updatedAt: "2025-01-01T00:00:00Z",
            },
          ],
          isLoading: false,
        };
      }

      if (typeof queryKey === "string" && queryKey.includes("/users")) {
        return { data: [{ id: "u1", name: "Approver User", email: "approver@example.com" }], isLoading: false };
      }

      if (typeof queryKey === "string" && queryKey.includes("/companies")) {
        return { data: [], isLoading: false };
      }

      if (typeof queryKey === "string" && queryKey.includes("/jobs")) {
        return { data: [], isLoading: false };
      }

      if (typeof queryKey === "string" && queryKey.includes("/suppliers")) {
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

describe("ApApprovalRulesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    renderWithProviders(<ApApprovalRulesPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Approval Rules");
  });

  it("renders the create rule button", () => {
    renderWithProviders(<ApApprovalRulesPage />);
    expect(screen.getByTestId("button-create-rule")).toBeInTheDocument();
  });

  it("displays rule name in the list", () => {
    renderWithProviders(<ApApprovalRulesPage />);
    expect(screen.getByText("High Value Approval")).toBeInTheDocument();
  });

  it("renders rule type badge", () => {
    renderWithProviders(<ApApprovalRulesPage />);
    expect(screen.getByTestId("badge-type-user")).toBeInTheDocument();
  });

  it("renders back button to invoices", () => {
    renderWithProviders(<ApApprovalRulesPage />);
    expect(screen.getByTestId("button-back-invoices")).toBeInTheDocument();
  });
});
