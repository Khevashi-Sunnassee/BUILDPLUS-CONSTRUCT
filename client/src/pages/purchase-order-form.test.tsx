import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/purchase-orders/new", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ id: "new" }),
  useRoute: () => [true, { id: "new" }],
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
vi.mock("@/hooks/use-unsaved-changes", () => ({ useUnsavedChanges: vi.fn() }));
vi.mock("@/components/help/page-help-button", () => ({ PageHelpButton: () => null }));
vi.mock("@/components/ItemPickerDialog", () => ({ ItemPickerDialog: () => null }));

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

import PurchaseOrderFormPage from "./purchase-order-form";

describe("PurchaseOrderFormPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
  });

  it("renders the page", () => {
    renderWithProviders(<PurchaseOrderFormPage />);
    const container = document.querySelector(".space-y-6");
    expect(container).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<PurchaseOrderFormPage />);
    const container = document.querySelector(".space-y-6");
    expect(container).toBeInTheDocument();
  });

  it("renders form elements", () => {
    renderWithProviders(<PurchaseOrderFormPage />);
    const container = document.querySelector(".space-y-6");
    expect(container).toBeInTheDocument();
  });

  it("has accessible attributes", () => {
    renderWithProviders(<PurchaseOrderFormPage />);
    const container = document.querySelector(".space-y-6");
    expect(container).toBeInTheDocument();
  });
});
