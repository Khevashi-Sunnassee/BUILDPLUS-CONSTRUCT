import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import TenderDetailPage from "./tender-detail";

vi.mock("wouter", () => ({
  useLocation: () => ["/tenders/test-id", vi.fn()],
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

vi.mock("@/components/EntitySidebar", () => ({
  EntitySidebar: () => <div data-testid="mock-entity-sidebar" />,
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn((options: any) => {
      const queryKey = Array.isArray(options.queryKey) ? options.queryKey[0] : options.queryKey;

      if (queryKey === "/api/tenders" && Array.isArray(options.queryKey) && options.queryKey.length >= 2) {
        const secondKey = options.queryKey[1];
        if (secondKey === "test-id") {
          const thirdKey = options.queryKey[2];
          if (!thirdKey) {
            return {
              data: {
                id: "test-id",
                tenderNumber: "TND-001",
                title: "Electrical Works Tender",
                description: "Tender for electrical installations",
                status: "OPEN",
                openDate: new Date().toISOString(),
                closedDate: null,
                dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
                notes: null,
                createdAt: new Date().toISOString(),
                jobId: "job1",
                job: { id: "job1", name: "Main Project", jobNumber: "JOB-001" },
                createdBy: { id: "1", name: "Test User" },
                members: [],
              },
              isLoading: false,
              error: null,
            };
          }
          return { data: [], isLoading: false };
        }
        return { data: [], isLoading: false };
      }

      return { data: [], isLoading: false };
    }),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

describe("TenderDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page container", () => {
    renderWithProviders(<TenderDetailPage />);
    expect(screen.getByTestId("tender-detail-page")).toBeInTheDocument();
  });

  it("displays tender title", () => {
    renderWithProviders(<TenderDetailPage />);
    expect(screen.getByText("Electrical Works Tender")).toBeInTheDocument();
  });

  it("displays tender number", () => {
    renderWithProviders(<TenderDetailPage />);
    expect(screen.getByText("TND-001")).toBeInTheDocument();
  });

  it("renders the status badge", () => {
    renderWithProviders(<TenderDetailPage />);
    expect(screen.getByTestId("badge-status-OPEN")).toBeInTheDocument();
  });

  it("displays job info", () => {
    renderWithProviders(<TenderDetailPage />);
    expect(screen.getByText(/JOB-001/)).toBeInTheDocument();
  });
});
