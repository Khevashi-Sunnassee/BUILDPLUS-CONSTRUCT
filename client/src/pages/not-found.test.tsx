import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("renders the not found page", () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByTestId("page-not-found")).toBeInTheDocument();
  });

  it("displays the 404 title", () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByTestId("text-404-title")).toHaveTextContent("404 Page Not Found");
  });

  it("shows go back button", () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByTestId("button-go-back")).toBeInTheDocument();
    expect(screen.getByTestId("button-go-back")).toHaveTextContent("Go Back");
  });

  it("shows description message", () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByTestId("text-404-message")).toBeInTheDocument();
  });
});
