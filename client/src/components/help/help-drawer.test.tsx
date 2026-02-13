import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { HelpDrawer } from "./help-drawer";

vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useRoute: () => [false, {}],
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

const mockOpenDrawer = vi.fn();
const mockCloseDrawer = vi.fn();

vi.mock("./help-provider", () => ({
  useHelpContext: () => ({
    drawerOpen: true,
    drawerKey: "test.key",
    openDrawer: mockOpenDrawer,
    closeDrawer: mockCloseDrawer,
  }),
  useHelp: () => ({
    data: {
      id: "1",
      key: "test.key",
      title: "Test Help Title",
      shortText: "Short description",
      bodyMd: "## Body content\n\nSome help text here.",
      scope: "page",
      category: "general",
    },
    isLoading: false,
  }),
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

describe("HelpDrawer", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders help drawer with testid", () => {
    renderWithProviders(<HelpDrawer />);
    expect(screen.getByTestId("help-drawer")).toBeInTheDocument();
  });

  it("displays the help entry title", () => {
    renderWithProviders(<HelpDrawer />);
    expect(screen.getByText("Test Help Title")).toBeInTheDocument();
  });

  it("shows short text description", () => {
    renderWithProviders(<HelpDrawer />);
    expect(screen.getByText("Short description")).toBeInTheDocument();
  });

  it("shows feedback toggle button", () => {
    renderWithProviders(<HelpDrawer />);
    expect(screen.getByTestId("help-feedback-toggle")).toBeInTheDocument();
  });
});
