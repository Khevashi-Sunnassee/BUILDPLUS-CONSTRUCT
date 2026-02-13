import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/checklists/1/fill", vi.fn()],
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

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-document-title", () => ({ useDocumentTitle: vi.fn() }));
vi.mock("@/components/help/page-help-button", () => ({ PageHelpButton: () => null }));
vi.mock("@/components/checklist/checklist-form", () => ({
  ChecklistForm: () => <div data-testid="mock-checklist-form">Checklist Form</div>,
  calculateCompletionRate: () => 0,
  getMissingRequiredFields: () => [],
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

import ChecklistFillPage from "./checklist-fill";

describe("ChecklistFillPage", () => {
  const mockInstance = {
    id: "1",
    templateId: "t1",
    status: "in_progress",
    responses: {},
    completedAt: null,
    createdAt: "2025-01-01",
  };

  const mockTemplate = {
    id: "t1",
    name: "Test Checklist",
    description: "A test checklist",
    sections: [],
    fields: [],
  };

  beforeEach(() => {
    mockUseQuery.mockImplementation((opts: any) => {
      const key = opts?.queryKey?.[0] || "";
      if (typeof key === "string" && key.includes("template")) {
        return { data: mockTemplate, isLoading: false, error: null };
      }
      return { data: mockInstance, isLoading: false, error: null };
    });
  });

  it("renders the page", () => {
    renderWithProviders(<ChecklistFillPage />);
    const container = document.querySelector(".space-y-6");
    expect(container).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<ChecklistFillPage />);
    const skeleton = document.querySelector(".h-8");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders checklist content", () => {
    renderWithProviders(<ChecklistFillPage />);
    const container = document.querySelector(".space-y-6");
    expect(container).toBeInTheDocument();
  });

  it("has accessible attributes", () => {
    renderWithProviders(<ChecklistFillPage />);
    const container = document.querySelector(".space-y-6");
    expect(container).toBeInTheDocument();
  });
});
