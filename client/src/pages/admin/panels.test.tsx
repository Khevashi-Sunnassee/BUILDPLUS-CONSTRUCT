import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import PanelsPage from "./panels";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/panels", vi.fn()],
  useSearch: () => "",
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

vi.mock("./panels/PanelDialogs", () => ({
  ImportDialog: () => null,
  DeleteDialog: () => null,
  DeleteSourceDialog: () => null,
  TemplateDialog: () => null,
  QrCodeDialog: () => null,
  ConsolidationDialog: () => null,
}));

vi.mock("./panels/PanelEditDialog", () => ({
  PanelEditDialog: () => null,
}));

vi.mock("./panels/PanelBuildDialog", () => ({
  PanelBuildDialog: () => null,
}));

vi.mock("./panels/PanelTableRow", () => ({
  PanelTableRow: () => null,
}));

vi.mock("./panels/PanelAuditLogTab", () => ({
  PanelAuditLogTab: () => null,
}));

vi.mock("./panels/PanelChatTab", () => ({
  PanelChatTab: () => null,
}));

vi.mock("./panels/PanelDocumentsTab", () => ({
  PanelDocumentsTab: () => null,
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

describe("PanelsPage", () => {
  it("shows loading state with aria-busy", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<PanelsPage />);
    const busyContainer = document.querySelector("[aria-busy='true']");
    expect(busyContainer).toBeInTheDocument();
  });

  it("renders with role main and aria-label Panels Management", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<PanelsPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Panels Management");
  });

  it("shows page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<PanelsPage />);
    expect(screen.getByTestId("text-panels-title")).toBeInTheDocument();
  });

  it("shows create panel button", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<PanelsPage />);
    expect(screen.getByTestId("button-create-panel")).toBeInTheDocument();
  });
});
