import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "./alert-dialog";

describe("AlertDialog", () => {
  it("renders when open", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("renders action and cancel buttons", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(
      <AlertDialog open={false}>
        <AlertDialogContent>
          <AlertDialogTitle>Hidden</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});
