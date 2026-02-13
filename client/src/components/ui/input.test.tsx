import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("accepts a value", () => {
    render(<Input value="test value" readOnly />);
    expect(screen.getByDisplayValue("test value")).toBeInTheDocument();
  });

  it("handles change events", async () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    await userEvent.type(screen.getByRole("textbox"), "hello");
    expect(handleChange).toHaveBeenCalled();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Input disabled placeholder="Disabled" />);
    expect(screen.getByPlaceholderText("Disabled")).toBeDisabled();
  });
});
