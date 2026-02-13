import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import LandingPage from "./landing";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ id: "1" }),
  useRoute: () => [true, { id: "1" }],
}));

vi.mock("@/hooks/use-document-title", () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock("@/assets/images/hero-construction.png", () => ({
  default: "mock-hero.png",
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

describe("LandingPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });
  });

  it("renders the landing page container", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByTestId("page-landing")).toBeInTheDocument();
  });

  it("displays hero heading text", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByTestId("text-hero-heading")).toBeInTheDocument();
  });

  it("renders feature cards", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByTestId("card-feature-kpi")).toBeInTheDocument();
    expect(screen.getByTestId("card-feature-quality")).toBeInTheDocument();
    expect(screen.getByTestId("card-feature-logistics")).toBeInTheDocument();
  });

  it("renders login buttons with correct test ids", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByTestId("button-header-login")).toBeInTheDocument();
    expect(screen.getByTestId("button-hero-login")).toBeInTheDocument();
    expect(screen.getByTestId("button-cta-login")).toBeInTheDocument();
  });
});
