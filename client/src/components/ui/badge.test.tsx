import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders text content", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("renders with default variant", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("renders with destructive variant", () => {
    render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    expect(screen.getByText("Custom")).toHaveClass("custom-badge");
  });
});
