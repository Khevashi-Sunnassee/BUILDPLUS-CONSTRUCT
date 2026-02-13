import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("renders with header and title", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
      </Card>
    );
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  it("renders with content and footer", () => {
    render(
      <Card>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Card className="custom-class">Content</Card>);
    expect(screen.getByText("Content").closest("div")).toHaveClass("custom-class");
  });
});
