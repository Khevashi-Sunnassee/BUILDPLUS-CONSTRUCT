import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import FactoriesPage from "./factories";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/factories", vi.fn()],
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

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div data-testid="mock-map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: ({ children }: any) => <div>{children}</div>,
  useMapEvents: () => null,
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn() }),
}));

vi.mock("leaflet", () => {
  const mockIcon = { Default: { prototype: {}, mergeOptions: vi.fn() } };
  return {
    default: { Icon: mockIcon, icon: vi.fn(), divIcon: vi.fn(), latLngBounds: vi.fn() },
    Icon: mockIcon,
    icon: vi.fn(),
    divIcon: vi.fn(),
    latLngBounds: vi.fn(),
  };
});

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("FactoriesPage", () => {
  it("shows loading skeleton when data is loading", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<FactoriesPage />);
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<FactoriesPage />);
    expect(screen.getByText("Factory Management")).toBeInTheDocument();
  });

  it("shows add factory button", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<FactoriesPage />);
    expect(screen.getByTestId("button-add-factory")).toBeInTheDocument();
  });

  it("renders facility description text", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<FactoriesPage />);
    expect(screen.getByText("Manage production facilities and their beds")).toBeInTheDocument();
  });
});
