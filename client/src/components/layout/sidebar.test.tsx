import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { AppSidebar } from "./sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useRoute: () => [false, {}],
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Test User", email: "test@test.com", role: "ADMIN" },
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/lib/notification-sound", () => ({
  playNotificationSound: vi.fn(),
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("AppSidebar", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders sidebar with main navigation label", () => {
    renderWithProviders(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );
    const sidebar = screen.getByLabelText("Main navigation");
    expect(sidebar).toBeInTheDocument();
  });

  it("renders Dashboard navigation item", () => {
    renderWithProviders(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders Main section group label", () => {
    renderWithProviders(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );
    expect(screen.getByText("Main")).toBeInTheDocument();
  });

  it("renders Settings section for admin users", () => {
    renderWithProviders(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
