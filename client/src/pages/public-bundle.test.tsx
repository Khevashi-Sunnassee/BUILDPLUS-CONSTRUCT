import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import PublicBundlePage from "./public-bundle";

vi.mock("wouter", () => ({
  useLocation: () => ["/public-bundle/test-qr", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({ qrCodeId: "test-qr-id" }),
  useRoute: () => [true, { qrCodeId: "test-qr-id" }],
}));

vi.mock("@/hooks/use-document-title", () => ({
  useDocumentTitle: vi.fn(),
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

describe("PublicBundlePage", () => {
  it("shows loading spinner while fetching bundle", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<PublicBundlePage />);
    expect(screen.getByText("Loading bundle...")).toBeInTheDocument();
  });

  it("shows error alert when bundle fails to load", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error("Not found") });
    renderWithProviders(<PublicBundlePage />);
    expect(screen.getByText("Bundle Unavailable")).toBeInTheDocument();
  });

  it("renders bundle name and documents when loaded", () => {
    mockUseQuery.mockReturnValue({
      data: {
        bundleName: "Test Bundle",
        description: "Test description",
        items: [
          { id: "doc-1", title: "Doc 1", originalName: "doc1.pdf", fileSize: 1024, mimeType: "application/pdf" },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderWithProviders(<PublicBundlePage />);
    expect(screen.getByTestId("text-bundle-name")).toHaveTextContent("Test Bundle");
    expect(screen.getByTestId("text-doc-title-doc-1")).toHaveTextContent("Doc 1");
    expect(screen.getByTestId("button-download-doc-1")).toBeInTheDocument();
  });

  it("shows bundle not found when no data", () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false, error: null });
    renderWithProviders(<PublicBundlePage />);
    expect(screen.getByText("Bundle Not Found")).toBeInTheDocument();
  });
});
