import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/photo-gallery", vi.fn()],
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

import PhotoGallery from "./photo-gallery";

describe("PhotoGallery", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
  });

  it("renders the page", () => {
    renderWithProviders(<PhotoGallery />);
    expect(screen.getByTestId("photo-gallery-page")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<PhotoGallery />);
    expect(screen.getByTestId("photo-gallery-page")).toBeInTheDocument();
  });

  it("renders page title", () => {
    renderWithProviders(<PhotoGallery />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Photo Gallery");
  });

  it("has accessible attributes", () => {
    renderWithProviders(<PhotoGallery />);
    expect(screen.getByTestId("photo-gallery-page")).toBeInTheDocument();
    expect(screen.getByTestId("text-page-title")).toBeInTheDocument();
  });
});
