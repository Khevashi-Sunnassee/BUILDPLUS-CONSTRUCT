import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/panels/1", vi.fn()],
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

import PanelDetailsPage from "./panel-details";

describe("PanelDetailsPage", () => {
  const mockPanel = {
    id: "1",
    panelMark: "P001",
    panelType: "WALL",
    panelTypeName: "Wall Panel",
    status: "PENDING",
    documentStatus: "PENDING",
    currentZone: "Z1",
    zoneName: "Zone 1",
    level: "L1",
    loadWidth: 3000,
    loadHeight: 2000,
    panelThickness: 200,
    estimatedVolume: 1.2,
    estimatedWeight: 2880,
    jobNumber: "J001",
    jobName: "Test Job",
    productionDate: null,
    deliveryDate: null,
    factory: "Factory A",
    createdAt: "2025-01-01",
    history: [],
  };

  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: mockPanel, isLoading: false, error: null });
  });

  it("renders the page", () => {
    renderWithProviders(<PanelDetailsPage />);
    expect(screen.getByTestId("panel-details-page")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<PanelDetailsPage />);
    const skeleton = document.querySelector(".h-12");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders panel mark", () => {
    renderWithProviders(<PanelDetailsPage />);
    expect(screen.getByTestId("text-panel-mark")).toHaveTextContent("P001");
  });

  it("has accessible attributes", () => {
    renderWithProviders(<PanelDetailsPage />);
    expect(screen.getByTestId("panel-details-page")).toBeInTheDocument();
    expect(screen.getByTestId("badge-status")).toBeInTheDocument();
    expect(screen.getByTestId("text-job-info")).toBeInTheDocument();
  });
});
