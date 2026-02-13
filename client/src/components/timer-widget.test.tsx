import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { TimerWidget } from "./timer-widget";

vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useRoute: () => [false, {}],
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("TimerWidget", () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });
  });

  it("renders timer display showing 00:00:00", () => {
    renderWithProviders(<TimerWidget />);
    expect(screen.getByTestId("text-timer-display")).toHaveTextContent("00:00:00");
  });

  it("renders start button when no active session", () => {
    renderWithProviders(<TimerWidget />);
    expect(screen.getByTestId("button-timer-start")).toBeInTheDocument();
  });

  it("does not show pause or stop buttons without active session", () => {
    renderWithProviders(<TimerWidget />);
    expect(screen.queryByTestId("button-timer-pause")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-timer-stop")).not.toBeInTheDocument();
  });
});
