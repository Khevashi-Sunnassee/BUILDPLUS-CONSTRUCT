import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import DownloadsPage from "./downloads";

vi.mock("wouter", () => ({
  useLocation: () => ["/downloads", vi.fn()],
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

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-document-title", () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock("@/components/help/page-help-button", () => ({
  PageHelpButton: () => null,
}));

describe("DownloadsPage", () => {
  it("renders the downloads page title", () => {
    renderWithProviders(<DownloadsPage />);
    expect(screen.getByTestId("text-downloads-title")).toHaveTextContent("Downloads & Setup");
  });

  it("shows download buttons for each tool", () => {
    renderWithProviders(<DownloadsPage />);
    expect(screen.getByTestId("button-download-revit")).toBeInTheDocument();
    expect(screen.getByTestId("button-download-acad")).toBeInTheDocument();
    expect(screen.getByTestId("button-download-agent")).toBeInTheDocument();
  });

  it("shows setup guide button", () => {
    renderWithProviders(<DownloadsPage />);
    expect(screen.getByTestId("button-setup-guide")).toBeInTheDocument();
  });

  it("renders installation guide tabs", () => {
    renderWithProviders(<DownloadsPage />);
    expect(screen.getByTestId("tab-revit")).toBeInTheDocument();
    expect(screen.getByTestId("tab-acad")).toBeInTheDocument();
    expect(screen.getByTestId("tab-agent")).toBeInTheDocument();
  });
});
