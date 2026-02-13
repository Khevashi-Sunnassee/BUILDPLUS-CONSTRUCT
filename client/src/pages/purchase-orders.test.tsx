import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

vi.mock("dompurify", () => ({
  default: { sanitize: (html: string) => html },
}));

vi.mock("jspdf", () => ({
  default: vi.fn(),
}));

import PurchaseOrdersPage from "./purchase-orders";

vi.mock("wouter", () => ({
  useLocation: () => ["/purchase-orders", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Admin User", email: "admin@test.com", role: "admin" },
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

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: [],
      isLoading: false,
    })),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

describe("PurchaseOrdersPage", () => {
  it("renders with role main and aria-label Purchase Orders", () => {
    renderWithProviders(<PurchaseOrdersPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Purchase Orders");
  });

  it("shows search input with aria-label", () => {
    renderWithProviders(<PurchaseOrdersPage />);
    const searchInput = screen.getByLabelText("Search purchase orders");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute("data-testid", "input-search-po");
  });

  it("shows loading state with aria-busy", async () => {
    const { useQuery } = await import("@tanstack/react-query");
    (useQuery as any).mockImplementation(() => ({
      data: undefined,
      isLoading: true,
    }));

    renderWithProviders(<PurchaseOrdersPage />);
    const busyElement = document.querySelector("[aria-busy='true']");
    expect(busyElement).toBeInTheDocument();
  });

  it("displays page title", () => {
    renderWithProviders(<PurchaseOrdersPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("Purchase Orders");
  });
});
