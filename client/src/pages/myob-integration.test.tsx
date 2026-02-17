import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import MyobIntegrationPage from "./myob-integration";

vi.mock("wouter", () => ({
  useLocation: () => ["/myob-integration", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
    },
    logout: vi.fn(),
  })),
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
    useQuery: vi.fn((options: any) => {
      const queryKey = Array.isArray(options.queryKey) ? options.queryKey[0] : options.queryKey;

      if (typeof queryKey === "string" && queryKey.includes("myob") && queryKey.includes("status")) {
        return {
          data: { connected: false },
          isLoading: false,
        };
      }

      return { data: undefined, isLoading: false };
    }),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  };
});

describe("MyobIntegrationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    renderWithProviders(<MyobIntegrationPage />);
    expect(screen.getByTestId("text-page-title")).toHaveTextContent("MYOB Integration");
  });

  it("displays not connected badge when disconnected", () => {
    renderWithProviders(<MyobIntegrationPage />);
    expect(screen.getByTestId("badge-connection-status")).toHaveTextContent("Not Connected");
  });

  it("renders connect button when not connected", () => {
    renderWithProviders(<MyobIntegrationPage />);
    expect(screen.getByTestId("button-connect-myob")).toBeInTheDocument();
  });

  it("displays connect card description", () => {
    renderWithProviders(<MyobIntegrationPage />);
    expect(screen.getByText("Connect to MYOB")).toBeInTheDocument();
  });

  it("shows feature descriptions in connect card", () => {
    renderWithProviders(<MyobIntegrationPage />);
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("Financials")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
  });
});
