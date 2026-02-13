import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import DocumentRegister from "./index";

vi.mock("wouter", () => ({
  useLocation: () => ["/documents", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useRoute: () => [false, {}],
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Test User", email: "test@test.com", role: "ADMIN" },
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
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("DocumentRegister (subfolder index)", () => {
  it("renders page with testid", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    renderWithProviders(<DocumentRegister />);
    expect(screen.getByTestId("document-register-page")).toBeInTheDocument();
  });

  it("renders page title Document Register", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<DocumentRegister />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Document Register");
  });

  it("renders with role main", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<DocumentRegister />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Document Register");
  });

  it("shows upload document button", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<DocumentRegister />);
    expect(screen.getByTestId("button-upload-document")).toBeInTheDocument();
  });
});
