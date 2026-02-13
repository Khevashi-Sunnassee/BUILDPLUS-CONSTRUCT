import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import KPIDashboardPage from "./kpi-dashboard";

vi.mock("wouter", () => ({
  useLocation: () => ["/kpi-dashboard", vi.fn()],
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

vi.mock("recharts", () => ({
  BarChart: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Legend: () => null,
  ComposedChart: () => null,
  Line: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: undefined,
      isLoading: true,
    })),
  };
});

describe("KPIDashboardPage", () => {
  it("renders with role main and aria-label KPI Dashboard", () => {
    renderWithProviders(<KPIDashboardPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "KPI Dashboard");
  });

  it("shows period filter with aria-label", () => {
    renderWithProviders(<KPIDashboardPage />);
    const periodFilter = screen.getByLabelText("Filter by period");
    expect(periodFilter).toBeInTheDocument();
  });

  it("shows loading state with skeleton placeholders", () => {
    renderWithProviders(<KPIDashboardPage />);
    const skeletons = document.querySelectorAll(".animate-pulse, [class*='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays page title", () => {
    renderWithProviders(<KPIDashboardPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("KPI Dashboard");
  });
});
