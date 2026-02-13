import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import SettingsPage from "./settings";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/settings", vi.fn()],
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

const settingsData = { tz: "Australia/Melbourne", captureIntervalS: 300, idleThresholdS: 300, trackedApps: "revit,acad", requireAddins: true };

let loadingMode = true;
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (opts: any) => {
      if (loadingMode) {
        return { data: undefined, isLoading: true };
      }
      const key = Array.isArray(opts.queryKey) ? opts.queryKey[0] : "";
      if (key.includes("settings")) {
        return { data: settingsData, isLoading: false };
      }
      return { data: [], isLoading: false };
    },
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("SettingsPage", () => {
  it("shows loading state with aria-busy", () => {
    loadingMode = true;
    renderWithProviders(<SettingsPage />);
    const busyContainer = document.querySelector("[aria-busy='true']");
    expect(busyContainer).toBeInTheDocument();
  });

  it("renders with role main and aria-label System Settings", () => {
    loadingMode = false;
    renderWithProviders(<SettingsPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "System Settings");
  });

  it("shows page title", () => {
    loadingMode = false;
    renderWithProviders(<SettingsPage />);
    expect(screen.getByTestId("text-settings-title")).toBeInTheDocument();
    expect(screen.getByTestId("text-settings-title")).toHaveTextContent("Global Settings");
  });

  it("shows company name input", () => {
    loadingMode = false;
    renderWithProviders(<SettingsPage />);
    expect(screen.getByTestId("input-company-name")).toBeInTheDocument();
  });
});
