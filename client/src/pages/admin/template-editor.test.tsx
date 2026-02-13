import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/checklist-templates/1/edit", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ id: "1" }),
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
vi.mock("@/components/checklist/normalize-sections", () => ({ normalizeSections: (s: any) => s || [] }));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

import TemplateEditorPage from "./template-editor";

describe("TemplateEditorPage", () => {
  it("renders the page", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<TemplateEditorPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<TemplateEditorPage />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });

  it("renders page title when template loaded", () => {
    mockUseQuery.mockReturnValue({
      data: { id: "1", name: "Test Template", description: "A test", sections: [] },
      isLoading: false,
    });
    renderWithProviders(<TemplateEditorPage />);
    expect(screen.getByText("Test Template")).toBeInTheDocument();
  });

  it("has accessible attributes", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<TemplateEditorPage />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-label", "Template Editor");
  });
});
