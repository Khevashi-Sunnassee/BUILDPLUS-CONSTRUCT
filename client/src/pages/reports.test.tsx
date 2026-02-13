import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ReportsPage from "./reports";

vi.mock("wouter", () => ({
  useLocation: () => ["/reports", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
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
  PageHelpButton: () => <div data-testid="mock-help-button" />,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  Legend: () => <div />,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => <div />,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
}));

describe("ReportsPage", () => {
  it("renders with role main and aria-label Reports", () => {
    renderWithProviders(<ReportsPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Reports");
  });

  it("shows report title", () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByTestId("text-reports-title")).toBeInTheDocument();
    expect(screen.getByText("Reports & Analytics")).toBeInTheDocument();
  });

  it("shows period selection with accessibility attributes", () => {
    renderWithProviders(<ReportsPage />);
    const periodSelect = screen.getByTestId("select-period");
    expect(periodSelect).toBeInTheDocument();
    expect(periodSelect).toHaveAttribute("aria-label", "Filter by period");
  });

  it("shows export PDF button", () => {
    renderWithProviders(<ReportsPage />);
    const exportBtn = screen.getByTestId("button-export-pdf");
    expect(exportBtn).toBeInTheDocument();
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
  });
});
