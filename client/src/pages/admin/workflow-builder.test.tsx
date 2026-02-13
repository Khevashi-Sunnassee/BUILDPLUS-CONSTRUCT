import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/job-types/1/workflow", vi.fn()],
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

import WorkflowBuilderPage from "./workflow-builder";

function mockLoaded() {
  mockUseQuery.mockImplementation((opts: any) => {
    const key = Array.isArray(opts?.queryKey) ? opts.queryKey[0] : "";
    if (typeof key === "string" && key.includes("job-type") && !key.includes("templates")) {
      return { data: { id: "1", name: "Test Job Type", isActive: true }, isLoading: false };
    }
    return { data: [], isLoading: false };
  });
}

describe("WorkflowBuilderPage", () => {
  it("renders the page", () => {
    mockLoaded();
    renderWithProviders(<WorkflowBuilderPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<WorkflowBuilderPage />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });

  it("renders page title", () => {
    mockLoaded();
    renderWithProviders(<WorkflowBuilderPage />);
    expect(screen.getByTestId("text-page-title")).toBeInTheDocument();
  });

  it("has accessible attributes", () => {
    mockLoaded();
    renderWithProviders(<WorkflowBuilderPage />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-label", "Workflow Builder");
    expect(screen.getByTestId("button-back")).toBeInTheDocument();
    expect(screen.getByTestId("button-add-activity")).toBeInTheDocument();
  });
});
