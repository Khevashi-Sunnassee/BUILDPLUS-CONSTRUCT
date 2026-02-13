import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import JobBoqPage from "./job-boq";

vi.mock("wouter", () => ({
  useLocation: () => ["/jobs/1/boq", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({}),
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

describe("JobBoqPage", () => {
  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<JobBoqPage />);
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders with role main and aria-label Job BOQ", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<JobBoqPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Job BOQ");
  });

  it("renders page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<JobBoqPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Bill of Quantities");
  });

  it("has add group and add item buttons", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<JobBoqPage />);
    expect(screen.getByTestId("button-add-group")).toBeInTheDocument();
    expect(screen.getByTestId("button-add-item")).toBeInTheDocument();
  });
});
