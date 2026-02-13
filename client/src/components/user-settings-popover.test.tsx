import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { UserSettingsPopover } from "./user-settings-popover";

vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useRoute: () => [false, {}],
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("UserSettingsPopover", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders the settings trigger button", () => {
    renderWithProviders(<UserSettingsPopover />);
    expect(screen.getByTestId("button-user-settings")).toBeInTheDocument();
  });

  it("has accessible label for user settings", () => {
    renderWithProviders(<UserSettingsPopover />);
    expect(screen.getByLabelText("User settings")).toBeInTheDocument();
  });

  it("renders as a button element", () => {
    renderWithProviders(<UserSettingsPopover />);
    const button = screen.getByTestId("button-user-settings");
    expect(button.tagName).toBe("BUTTON");
  });
});
