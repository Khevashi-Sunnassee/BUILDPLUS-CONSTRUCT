import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/contracts/1", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ jobId: "1" }),
  useRoute: () => [true, { jobId: "1" }],
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

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

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

import ContractDetailPage from "./contract-detail";

describe("ContractDetailPage", () => {
  const mockJob = { id: "1", jobNumber: "J001", name: "Test Job", client: "Client A", address: "123 St" };

  beforeEach(() => {
    mockUseQuery.mockImplementation((opts: any) => {
      const key = JSON.stringify(opts?.queryKey || []);
      if (key.includes("jobs")) {
        return { data: mockJob, isLoading: false, error: null };
      }
      if (key.includes("document")) {
        return { data: [], isLoading: false, error: null };
      }
      return { data: null, isLoading: false, error: null };
    });
  });

  it("renders the page", () => {
    renderWithProviders(<ContractDetailPage />);
    expect(screen.getByTestId("contract-detail-page")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<ContractDetailPage />);
    const skeleton = document.querySelector(".h-10");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders page title", () => {
    renderWithProviders(<ContractDetailPage />);
    expect(screen.getByTestId("text-contract-title")).toBeInTheDocument();
  });

  it("has accessible attributes", () => {
    renderWithProviders(<ContractDetailPage />);
    expect(screen.getByTestId("contract-detail-page")).toBeInTheDocument();
    expect(screen.getByTestId("button-back-to-hub")).toBeInTheDocument();
  });
});
