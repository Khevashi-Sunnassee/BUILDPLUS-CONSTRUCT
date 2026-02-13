import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./dropdown-menu";

describe("DropdownMenu", () => {
  it("renders trigger", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText("Open Menu")).toBeInTheDocument();
  });

  it("renders trigger as button", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>Actions</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("trigger is clickable", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="menu-trigger">Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Option</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByTestId("menu-trigger")).toBeInTheDocument();
  });
});
