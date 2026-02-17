import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ApInvoiceDetailPage from "./ap-invoice-detail";

vi.mock("wouter", () => ({
  useLocation: () => ["/ap-invoices/inv-1", vi.fn()],
  useRoute: () => [true, { id: "inv-1" }],
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

const sampleInvoice = {
  id: "inv-1",
  invoiceNumber: "INV-001",
  supplierId: "s1",
  companyId: "c1",
  invoiceDate: "2025-01-10T00:00:00Z",
  dueDate: "2025-02-10T00:00:00Z",
  description: "Test invoice description",
  totalEx: "1000.00",
  totalTax: "100.00",
  totalInc: "1100.00",
  currency: "AUD",
  status: "PROCESSED",
  assigneeUserId: null,
  createdByUserId: "1",
  uploadedAt: "2025-01-15T00:00:00Z",
  riskScore: 25,
  riskReasons: ["Low amount"],
  isUrgent: false,
  isOnHold: false,
  postPeriod: null,
  supplier: { id: "s1", name: "Acme Corp" },
  assigneeUser: null,
  createdByUser: { id: "1", name: "Test User", email: "test@example.com" },
  documents: [],
  extractedFields: [],
  splits: [],
  approvals: [],
  activity: [],
  comments: [],
};

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn((options: any) => {
      const queryKey = Array.isArray(options.queryKey) ? options.queryKey[0] : options.queryKey;

      if (typeof queryKey === "string" && queryKey.includes("/splits")) {
        return { data: [], isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.includes("/approval-path")) {
        return { data: { steps: [], totalSteps: 0, completedSteps: 0, currentStepIndex: null }, isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.includes("/activity")) {
        return { data: [], isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.includes("/comments")) {
        return { data: [], isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.includes("/page-thumbnails")) {
        return { data: null, isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.includes("/ap-invoices/inv-1")) {
        return { data: sampleInvoice, isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.includes("/suppliers")) {
        return { data: [{ id: "s1", name: "Acme Corp" }], isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.includes("/cost-codes")) {
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

describe("ApInvoiceDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the risk card", () => {
    renderWithProviders(<ApInvoiceDetailPage />);
    expect(screen.getByTestId("card-risk")).toBeInTheDocument();
  });

  it("displays the risk level as Low Risk", () => {
    renderWithProviders(<ApInvoiceDetailPage />);
    expect(screen.getByTestId("text-risk-level")).toHaveTextContent("Low Risk");
  });

  it("displays the invoice total", () => {
    renderWithProviders(<ApInvoiceDetailPage />);
    expect(screen.getByTestId("text-invoice-total")).toBeInTheDocument();
  });

  it("renders the invoice summary card", () => {
    renderWithProviders(<ApInvoiceDetailPage />);
    expect(screen.getByTestId("card-invoice-summary")).toBeInTheDocument();
  });

  it("renders cost splits card", () => {
    renderWithProviders(<ApInvoiceDetailPage />);
    expect(screen.getByTestId("card-splits")).toBeInTheDocument();
  });
});
