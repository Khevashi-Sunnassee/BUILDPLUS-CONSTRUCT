import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import MobileBottomNav from "./MobileBottomNav";

vi.mock("wouter", () => ({
  useLocation: () => ["/mobile/dashboard"],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/hooks/use-mobile-permissions", () => ({
  useMobilePermissions: () => ({
    isHidden: () => false,
  }),
}));

describe("MobileBottomNav", () => {
  it("renders the navigation bar", () => {
    renderWithProviders(<MobileBottomNav />);
    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute("aria-label", "Mobile navigation");
  });

  it("renders Home tab with correct aria-current for active page", () => {
    renderWithProviders(<MobileBottomNav />);
    const homeLink = screen.getByLabelText("Home");
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("aria-current", "page");
  });

  it("renders all visible tabs", () => {
    renderWithProviders(<MobileBottomNav />);
    expect(screen.getByTestId("tab-home")).toBeInTheDocument();
    expect(screen.getByTestId("tab-jobs")).toBeInTheDocument();
    expect(screen.getByTestId("tab-scan")).toBeInTheDocument();
    expect(screen.getByTestId("tab-chat")).toBeInTheDocument();
    expect(screen.getByTestId("tab-more")).toBeInTheDocument();
  });

  it("has a tablist role on the container", () => {
    renderWithProviders(<MobileBottomNav />);
    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();
  });

  it("renders scan tab with correct accessibility label", () => {
    renderWithProviders(<MobileBottomNav />);
    const scanLink = screen.getByLabelText("Scan QR code");
    expect(scanLink).toBeInTheDocument();
  });
});
