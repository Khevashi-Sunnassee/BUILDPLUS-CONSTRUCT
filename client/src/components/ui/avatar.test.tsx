import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

describe("Avatar", () => {
  it("renders avatar element", () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("shows fallback text", () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("renders with AvatarImage component", () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.png" alt="User" />
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
    );
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <Avatar className="h-8 w-8">
        <AvatarFallback>X</AvatarFallback>
      </Avatar>
    );
    expect(container.firstChild).toHaveClass("h-8", "w-8");
  });
});
