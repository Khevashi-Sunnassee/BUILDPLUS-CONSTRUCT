import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import UsersPage from "./users";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/users", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useRoute: () => [false, {}],
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
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("UsersPage", () => {
  it("shows loading state with aria-busy", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<UsersPage />);
    const busyContainer = document.querySelector("[aria-busy='true']");
    expect(busyContainer).toBeInTheDocument();
  });

  it("renders with role main and aria-label User Management", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<UsersPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "User Management");
  });

  it("shows page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<UsersPage />);
    expect(screen.getByTestId("text-users-title")).toBeInTheDocument();
  });

  it("shows action buttons", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<UsersPage />);
    expect(screen.getByTestId("button-add-user")).toBeInTheDocument();
    expect(screen.getByTestId("button-invite-user")).toBeInTheDocument();
  });

  it("shows tabs for users and invitations", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<UsersPage />);
    expect(screen.getByTestId("tab-users")).toBeInTheDocument();
    expect(screen.getByTestId("tab-invitations")).toBeInTheDocument();
  });
});
