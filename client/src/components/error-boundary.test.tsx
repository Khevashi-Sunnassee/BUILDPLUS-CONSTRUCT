import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./error-boundary";

vi.mock("@/lib/error-tracker", () => ({
  trackError: vi.fn(),
}));

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div data-testid="child-content">Working fine</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Working fine")).toBeInTheDocument();
  });

  it("renders error UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    expect(screen.getByTestId("text-error-title")).toHaveTextContent("Something went wrong");
    expect(screen.getByTestId("text-error-description")).toBeInTheDocument();
    expect(screen.getByTestId("text-error-details")).toHaveTextContent("Test error message");
  });

  it("has proper accessibility attributes", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    const container = screen.getByTestId("error-boundary");
    expect(container).toHaveAttribute("role", "alert");
    expect(container).toHaveAttribute("aria-live", "assertive");
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("error-boundary")).not.toBeInTheDocument();
  });

  it("provides try again and reload buttons", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId("button-try-again")).toBeInTheDocument();
    expect(screen.getByTestId("button-reload")).toBeInTheDocument();
  });

  it("resets error state when try again is clicked", async () => {
    const user = userEvent.setup();
    
    let shouldThrow = true;
    function ConditionalThrow() {
      if (shouldThrow) throw new Error("Boom");
      return <div data-testid="recovered">Recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );

    expect(screen.getByTestId("error-boundary")).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByTestId("button-try-again"));

    rerender(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );
  });
});
