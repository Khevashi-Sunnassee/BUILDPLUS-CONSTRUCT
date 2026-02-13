import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";

describe("Tooltip", () => {
  it("renders trigger content", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  it("renders trigger as a button", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button>Button trigger</button>
          </TooltipTrigger>
          <TooltipContent>Info</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.getByText("Button trigger")).toBeInTheDocument();
  });

  it("renders multiple tooltips", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>First</TooltipTrigger>
          <TooltipContent>First tip</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>Second</TooltipTrigger>
          <TooltipContent>Second tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});
