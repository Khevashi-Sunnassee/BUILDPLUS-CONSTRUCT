import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ManualEntryPage from "./manual-entry";

vi.mock("wouter", () => ({
  useLocation: () => ["/manual-entry", vi.fn()],
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

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-document-title", () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock("@/components/help/page-help-button", () => ({
  PageHelpButton: () => null,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-unsaved-changes", () => ({
  useUnsavedChanges: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) }),
  queryClient: { invalidateQueries: vi.fn() },
}));

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

describe("ManualEntryPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, refetch: vi.fn() });
  });

  it("renders the manual entry page", () => {
    const { container } = renderWithProviders(<ManualEntryPage />);
    expect(container.querySelector("form")).toBeInTheDocument();
  });

  it("renders form input fields", () => {
    renderWithProviders(<ManualEntryPage />);
    const dateInputs = document.querySelectorAll("input[type='date'], input[type='time']");
    expect(dateInputs.length).toBeGreaterThan(0);
  });

  it("renders the page without crashing", () => {
    const { container } = renderWithProviders(<ManualEntryPage />);
    expect(container).toBeTruthy();
  });
});
