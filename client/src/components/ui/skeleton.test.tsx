import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders a div element", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("has animate-pulse class", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("has rounded-md class", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("rounded-md");
  });

  it("applies custom className", () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    expect(container.firstChild).toHaveClass("h-4", "w-full");
  });
});
