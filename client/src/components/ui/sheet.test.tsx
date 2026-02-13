import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./sheet";

describe("Sheet", () => {
  it("renders when open", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetDescription>Sheet description</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
    expect(screen.getByText("Sheet Title")).toBeInTheDocument();
    expect(screen.getByText("Sheet description")).toBeInTheDocument();
  });

  it("has close button", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>
    );
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("renders footer content", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <SheetFooter>Footer area</SheetFooter>
        </SheetContent>
      </Sheet>
    );
    expect(screen.getByText("Footer area")).toBeInTheDocument();
  });
});
