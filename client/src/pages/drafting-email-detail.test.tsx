import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import DraftingEmailDetailPage from "./drafting-email-detail";

vi.mock("wouter", () => ({
  useLocation: () => ["/drafting-emails/de-1", vi.fn()],
  useRoute: () => [true, { id: "de-1" }],
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

const sampleEmail = {
  id: "de-1",
  companyId: "c1",
  resendEmailId: "re1",
  fromAddress: "architect@example.com",
  toAddress: "drafting@company.com",
  subject: "Updated floor plans - Rev C",
  status: "PROCESSED",
  jobId: null,
  requestType: "drawing_update",
  impactArea: "drawing",
  attachmentCount: 2,
  processingError: null,
  processedAt: "2025-01-15T11:00:00Z",
  matchedAt: null,
  createdAt: "2025-01-15T10:30:00Z",
  job: null,
  documents: [
    { id: "doc1", fileName: "floor-plan-revC.pdf", mimeType: "application/pdf", storageKey: "key1", fileSize: 2048000 },
  ],
  extractedFields: [
    { id: "ef1", fieldKey: "request_type", fieldValue: "drawing_update", confidence: 0.95 },
    { id: "ef2", fieldKey: "impact_area", fieldValue: "drawing", confidence: 0.88 },
  ],
};

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn((options: any) => {
      const queryKey = Array.isArray(options.queryKey) ? options.queryKey[0] : options.queryKey;

      if (typeof queryKey === "string" && queryKey.includes("/email-body")) {
        return { data: { html: "<p>Please find updated floor plans attached.</p>", text: "Please find updated floor plans attached." }, isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.includes("/page-thumbnails")) {
        return { data: null, isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.includes("/activity")) {
        return { data: [], isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.endsWith("/emails/de-1")) {
        return { data: sampleEmail, isLoading: false };
      }
      if (typeof queryKey === "string" && queryKey.includes("/jobs")) {
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

describe("DraftingEmailDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the detail page container", () => {
    renderWithProviders(<DraftingEmailDetailPage />);
    expect(screen.getByTestId("page-drafting-email-detail")).toBeInTheDocument();
  });

  it("displays the email sender information", () => {
    renderWithProviders(<DraftingEmailDetailPage />);
    expect(screen.getByTestId("text-from")).toHaveTextContent("architect@example.com");
  });

  it("displays the email subject", () => {
    renderWithProviders(<DraftingEmailDetailPage />);
    expect(screen.getByTestId("text-subject")).toHaveTextContent("Updated floor plans - Rev C");
  });

  it("renders status badge", () => {
    renderWithProviders(<DraftingEmailDetailPage />);
    expect(screen.getByTestId("badge-status-processed")).toBeInTheDocument();
  });

  it("renders extracted fields card", () => {
    renderWithProviders(<DraftingEmailDetailPage />);
    expect(screen.getByTestId("card-extracted-fields")).toBeInTheDocument();
  });
});
