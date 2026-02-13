import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import BroadcastPage from "./broadcast";

vi.mock("wouter", () => ({
  useLocation: () => ["/broadcast", vi.fn()],
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

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
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

describe("BroadcastPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders the broadcast page", () => {
    const { container } = renderWithProviders(<BroadcastPage />);
    expect(container).toBeTruthy();
  });

  it("renders compose message section", () => {
    renderWithProviders(<BroadcastPage />);
    expect(screen.getByText("Compose Message")).toBeInTheDocument();
  });

  it("renders subject input", () => {
    renderWithProviders(<BroadcastPage />);
    expect(screen.getByTestId("input-broadcast-subject")).toBeInTheDocument();
  });

  it("renders message textarea", () => {
    renderWithProviders(<BroadcastPage />);
    expect(screen.getByTestId("input-broadcast-message")).toBeInTheDocument();
  });
});
