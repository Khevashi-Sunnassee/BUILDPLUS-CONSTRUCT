import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders a textarea element", () => {
    render(<Textarea placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("accepts a value", () => {
    render(<Textarea value="test content" readOnly />);
    expect(screen.getByDisplayValue("test content")).toBeInTheDocument();
  });

  it("handles change events", async () => {
    const handleChange = vi.fn();
    render(<Textarea onChange={handleChange} />);
    await userEvent.type(screen.getByRole("textbox"), "hello");
    expect(handleChange).toHaveBeenCalled();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Textarea disabled placeholder="Disabled" />);
    expect(screen.getByPlaceholderText("Disabled")).toBeDisabled();
  });
});
