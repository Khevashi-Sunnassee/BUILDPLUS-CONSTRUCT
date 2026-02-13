import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/pm-call-logs/1", vi.fn()],
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

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-document-title", () => ({ useDocumentTitle: vi.fn() }));
vi.mock("@/components/help/page-help-button", () => ({ PageHelpButton: () => null }));

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

import PmCallLogDetailPage from "./pm-call-log-detail";

describe("PmCallLogDetailPage", () => {
  const mockLog = {
    id: "1",
    jobId: "j1",
    jobName: "Test Job",
    jobNumber: "J001",
    contactName: "John Doe",
    contactPhone: "0412345678",
    callDateTime: "2025-01-15T10:00:00Z",
    draftingConcerns: "",
    clientDesignChanges: "",
    issuesReported: "",
    installationProblems: "",
    notes: "Test notes",
    levels: [],
    createdAt: "2025-01-15",
  };

  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: mockLog, isLoading: false, error: null });
  });

  it("renders the page", () => {
    renderWithProviders(<PmCallLogDetailPage />);
    expect(screen.getByTestId("text-detail-title")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<PmCallLogDetailPage />);
    const skeleton = document.querySelector(".h-8");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders detail title", () => {
    renderWithProviders(<PmCallLogDetailPage />);
    expect(screen.getByTestId("text-detail-title")).toBeInTheDocument();
  });

  it("has accessible attributes", () => {
    renderWithProviders(<PmCallLogDetailPage />);
    expect(screen.getByTestId("button-back")).toBeInTheDocument();
    expect(screen.getByTestId("text-contact-name")).toBeInTheDocument();
  });
});
