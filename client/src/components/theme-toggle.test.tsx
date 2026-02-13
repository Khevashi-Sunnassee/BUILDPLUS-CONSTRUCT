import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { ThemeToggle } from "./theme-toggle";

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

describe("ThemeToggle", () => {
  it("renders a button element", () => {
    renderWithProviders(<ThemeToggle />);
    const button = screen.getByTestId("button-theme-toggle");
    expect(button).toBeInTheDocument();
  });

  it("has accessible label for toggling dark mode", () => {
    renderWithProviders(<ThemeToggle />);
    const button = screen.getByLabelText("Toggle dark mode");
    expect(button).toBeInTheDocument();
  });

  it("contains screen reader text Toggle theme", () => {
    renderWithProviders(<ThemeToggle />);
    expect(screen.getByText("Toggle theme")).toBeInTheDocument();
  });
});
