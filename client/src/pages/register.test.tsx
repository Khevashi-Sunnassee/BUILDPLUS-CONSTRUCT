import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import RegisterPage from "./register";

vi.mock("wouter", () => ({
  useLocation: () => ["/register/test-token", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ token: "test-token" }),
  useRoute: () => [true, { token: "test-token" }],
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-document-title", () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
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

describe("RegisterPage", () => {
  it("shows loading state while validating invitation", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<RegisterPage />);
    expect(screen.getByText("Validating your invitation...")).toBeInTheDocument();
  });

  it("shows registration form when invitation is valid", () => {
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey?.[0]?.includes?.("invitation") || opts.queryKey?.[0]?.includes?.("validate")) {
        return { data: { valid: true, email: "test@test.com", companyName: "Test Co", role: "user", userType: "EMPLOYEE" }, isLoading: false, error: null };
      }
      return { data: null, isLoading: false, error: null };
    });
    renderWithProviders(<RegisterPage />);
    expect(screen.getByTestId("input-register-name")).toBeInTheDocument();
    expect(screen.getByTestId("input-register-password")).toBeInTheDocument();
    expect(screen.getByTestId("button-register-submit")).toBeInTheDocument();
  });

  it("shows invalid invitation card on error", () => {
    mockUseQuery.mockImplementation((opts: any) => {
      if (opts.queryKey?.[0]?.includes?.("invitation") || opts.queryKey?.[0]?.includes?.("validate")) {
        return { data: { valid: false }, isLoading: false, error: new Error("Invalid") };
      }
      return { data: null, isLoading: false, error: null };
    });
    renderWithProviders(<RegisterPage />);
    expect(screen.getByTestId("card-invitation-invalid")).toBeInTheDocument();
  });
});
