import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./select";

describe("Select", () => {
  it("renders trigger with placeholder", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Choose option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="opt1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByText("Choose option")).toBeInTheDocument();
  });

  it("renders with a selected value", () => {
    render(
      <Select value="opt1">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="opt1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByText("Option 1")).toBeInTheDocument();
  });

  it("renders trigger element", () => {
    render(
      <Select>
        <SelectTrigger data-testid="select-trigger">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId("select-trigger")).toBeInTheDocument();
  });
});
