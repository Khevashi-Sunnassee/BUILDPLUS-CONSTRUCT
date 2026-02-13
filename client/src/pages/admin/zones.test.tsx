import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/zones", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({}),
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
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

import AdminZonesPage from "./zones";

describe("AdminZonesPage", () => {
  it("renders the page", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<AdminZonesPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<AdminZonesPage />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });

  it("renders page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<AdminZonesPage />);
    expect(screen.getByTestId("text-zones-title")).toHaveTextContent("Zone Management");
  });

  it("has accessible attributes", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<AdminZonesPage />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-label", "Zone Management");
    expect(screen.getByTestId("button-create-zone")).toBeInTheDocument();
  });
});
