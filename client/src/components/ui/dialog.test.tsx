import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";

describe("Dialog", () => {
  it("renders when open", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    expect(screen.getByText("Dialog description")).toBeInTheDocument();
  });

  it("has close button", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("renders footer content", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogFooter>Footer content</DialogFooter>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Footer content")).toBeInTheDocument();
  });
});
