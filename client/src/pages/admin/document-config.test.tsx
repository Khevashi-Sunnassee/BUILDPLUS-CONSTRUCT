import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/document-config", vi.fn()],
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

import AdminDocumentConfigPage from "./document-config";

describe("AdminDocumentConfigPage", () => {
  it("renders the page", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<AdminDocumentConfigPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<AdminDocumentConfigPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<AdminDocumentConfigPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Document Configuration");
  });

  it("has accessible attributes", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<AdminDocumentConfigPage />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-label", "Document Configuration");
    expect(screen.getByTestId("tab-disciplines")).toBeInTheDocument();
    expect(screen.getByTestId("tab-categories")).toBeInTheDocument();
    expect(screen.getByTestId("tab-types")).toBeInTheDocument();
  });
});
