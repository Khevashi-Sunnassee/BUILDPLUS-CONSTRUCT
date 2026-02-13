import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { HelpIcon } from "./help-icon";

vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useRoute: () => [false, {}],
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

const mockOpenDrawer = vi.fn();

vi.mock("./help-provider", () => ({
  useHelpContext: () => ({
    drawerOpen: false,
    drawerKey: null,
    openDrawer: mockOpenDrawer,
    closeDrawer: vi.fn(),
  }),
  useHelp: () => ({
    data: {
      id: "1",
      key: "test.field",
      title: "Field Help",
      shortText: "This is a help tooltip",
      bodyMd: "## Detailed help\n\nMore info here.",
      scope: "field",
      category: "general",
    },
    isLoading: false,
  }),
}));

describe("HelpIcon", () => {
  it("renders help icon button with testid", () => {
    renderWithProviders(<HelpIcon helpKey="test.field" />);
    expect(screen.getByTestId("help-icon-test.field")).toBeInTheDocument();
  });

  it("has accessible label with help entry title", () => {
    renderWithProviders(<HelpIcon helpKey="test.field" />);
    expect(screen.getByLabelText("Help: Field Help")).toBeInTheDocument();
  });

  it("renders as a button element", () => {
    renderWithProviders(<HelpIcon helpKey="test.field" />);
    const icon = screen.getByTestId("help-icon-test.field");
    expect(icon.tagName).toBe("BUTTON");
  });
});
