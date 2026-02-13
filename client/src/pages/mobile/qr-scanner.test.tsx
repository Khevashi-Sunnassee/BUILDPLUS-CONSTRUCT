import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/mobile/qr-scanner", vi.fn()],
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

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/hooks/use-document-title", () => ({ useDocumentTitle: vi.fn() }));
vi.mock("@/components/help/page-help-button", () => ({ PageHelpButton: () => null }));
vi.mock("@/components/mobile/MobileBottomNav", () => ({ default: () => <div data-testid="mock-mobile-nav" /> }));
vi.mock("@/components/layout/mobile-layout", () => ({ default: ({ children, title }: any) => <div role="main" aria-label={title}>{children}</div> }));
vi.mock("html5-qrcode", () => ({
  Html5QrcodeScanner: class { render() {} clear() {} },
  Html5Qrcode: class {
    start() { return Promise.resolve(); }
    stop() { return Promise.resolve(); }
    clear() {}
    static getCameras() { return Promise.resolve([]); }
  },
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

import MobileQrScanner from "./qr-scanner";

describe("MobileQrScanner", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });
  });

  it("renders the QR scanner page", () => {
    renderWithProviders(<MobileQrScanner />);
    expect(screen.getByTestId("mock-mobile-nav")).toBeInTheDocument();
  });

  it("displays QR scanner heading", () => {
    renderWithProviders(<MobileQrScanner />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("QR Scanner");
  });

  it("has a back button", () => {
    renderWithProviders(<MobileQrScanner />);
    expect(screen.getByTestId("button-back")).toBeInTheDocument();
  });

  it("has accessible page structure", () => {
    const { container } = renderWithProviders(<MobileQrScanner />);
    expect(container.querySelector("div")).toBeInTheDocument();
  });
});
