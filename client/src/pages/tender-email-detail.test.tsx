import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import TenderEmailDetailPage from "./tender-email-detail";

vi.mock("wouter", () => ({
  useLocation: () => ["/tender-emails/test-id", vi.fn()],
  useRoute: () => [true, { id: "test-id" }],
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

      if (typeof queryKey === "string" && queryKey.includes("tender-inbox") && !queryKey.includes("activity")) {
        return {
          data: {
            id: "test-id",
            companyId: "comp1",
            resendEmailId: "re1",
            fromAddress: "supplier@example.com",
            toAddress: "tenders@example.com",
            subject: "Quote for Project ABC",
            status: "received",
            supplierId: null,
            tenderId: null,
            tenderSubmissionId: null,
            attachmentCount: 1,
            processingError: null,
            processedAt: null,
            matchedAt: null,
            createdAt: new Date().toISOString(),
            supplier: null,
            tender: null,
            tenderSubmission: null,
            documents: [{ id: "doc1", fileName: "quote.pdf", mimeType: "application/pdf", storageKey: "key1", fileSize: 12345 }],
            extractedFields: [],
          },
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

describe("TenderEmailDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page container", () => {
    renderWithProviders(<TenderEmailDetailPage />);
    expect(screen.getByTestId("page-tender-email-detail")).toBeInTheDocument();
  });

  it("displays email subject", () => {
    renderWithProviders(<TenderEmailDetailPage />);
    expect(screen.getByTestId("text-email-subject")).toHaveTextContent("Quote for Project ABC");
  });

  it("displays sender address", () => {
    renderWithProviders(<TenderEmailDetailPage />);
    expect(screen.getByTestId("text-from")).toHaveTextContent("supplier@example.com");
  });

  it("renders the status badge", () => {
    renderWithProviders(<TenderEmailDetailPage />);
    expect(screen.getByTestId("badge-status-received")).toBeInTheDocument();
  });

  it("renders the PDF viewer panel", () => {
    renderWithProviders(<TenderEmailDetailPage />);
    const panels = screen.getAllByTestId("panel-pdf-viewer");
    expect(panels.length).toBeGreaterThan(0);
  });
});
