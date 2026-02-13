import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { MobileLayout } from "./mobile-layout";

vi.mock("wouter", () => ({
  useLocation: () => ["/mobile/dashboard", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useRoute: () => [false, {}],
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("@/components/mobile/MobileBottomNav", () => ({
  MobileBottomNav: () => <div data-testid="mock-mobile-nav">Nav</div>,
}));

describe("MobileLayout", () => {
  it("renders children content", () => {
    renderWithProviders(
      <MobileLayout title="Test Page">
        <div data-testid="child-content">Hello</div>
      </MobileLayout>
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders the title in the header", () => {
    renderWithProviders(
      <MobileLayout title="My Title">
        <div>Content</div>
      </MobileLayout>
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("renders back button by default", () => {
    renderWithProviders(
      <MobileLayout title="Page">
        <div>Content</div>
      </MobileLayout>
    );
    expect(screen.getByTestId("button-back")).toBeInTheDocument();
  });

  it("hides back button when showBackButton is false", () => {
    renderWithProviders(
      <MobileLayout title="Page" showBackButton={false}>
        <div>Content</div>
      </MobileLayout>
    );
    expect(screen.queryByTestId("button-back")).not.toBeInTheDocument();
  });
});
