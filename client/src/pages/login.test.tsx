import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import LoginPage from "./login";

vi.mock("wouter", () => ({
  useLocation: () => ["/login", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

const mockLogin = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    logout: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-document-title", () => ({
  useDocumentTitle: vi.fn(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it("renders the login form with all required elements", () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText("Sign in", { selector: "[id='login-heading']" })).toBeInTheDocument();
    expect(screen.getByTestId("input-email")).toBeInTheDocument();
    expect(screen.getByTestId("input-password")).toBeInTheDocument();
    expect(screen.getByTestId("button-login")).toBeInTheDocument();
    expect(screen.getByTestId("button-toggle-password")).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    renderWithProviders(<LoginPage />);

    const mainContainer = screen.getByRole("main");
    expect(mainContainer).toHaveAttribute("aria-label", "Login page");

    const emailInput = screen.getByTestId("input-email");
    expect(emailInput).toHaveAttribute("aria-required", "true");
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("autocomplete", "email");

    const passwordInput = screen.getByTestId("input-password");
    expect(passwordInput).toHaveAttribute("aria-required", "true");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const passwordInput = screen.getByTestId("input-password");
    const toggleButton = screen.getByTestId("button-toggle-password");

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(toggleButton).toHaveAttribute("aria-label", "Show password");
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(toggleButton).toHaveAttribute("aria-label", "Hide password");
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
  });

  it("validates email field is required", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByTestId("button-login"));
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("submits the form with valid credentials", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByTestId("input-email"), "admin@test.com");
    await user.type(screen.getByTestId("input-password"), "password123");
    await user.click(screen.getByTestId("button-login"));

    expect(mockLogin).toHaveBeenCalledWith("admin@test.com", "password123");
  });

  it("displays the heading and description", () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText("Performance Management")).toBeInTheDocument();
    expect(screen.getByText("KPI Tracking & Drafting Management")).toBeInTheDocument();
    expect(screen.getByText("Enter your credentials to access your account")).toBeInTheDocument();
  });

  it("disables submit button while loading", async () => {
    mockLogin.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByTestId("input-email"), "admin@test.com");
    await user.type(screen.getByTestId("input-password"), "password123");
    await user.click(screen.getByTestId("button-login"));

    expect(screen.getByTestId("button-login")).toBeDisabled();
  });
});
