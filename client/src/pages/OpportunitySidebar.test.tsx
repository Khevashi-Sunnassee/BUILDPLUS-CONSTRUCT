import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { OpportunitySidebar } from "./OpportunitySidebar";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
    },
    logout: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-document-title", () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock("@/components/help/page-help-button", () => ({
  PageHelpButton: () => null,
}));

vi.mock("@/components/EntitySidebar", () => ({
  EntitySidebar: ({ entityName, onClose, testIdPrefix }: any) => (
    <div data-testid={`${testIdPrefix}-sidebar`}>
      <span data-testid={`${testIdPrefix}-entity-name`}>{entityName}</span>
      <button data-testid={`${testIdPrefix}-close`} onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  };
});

describe("OpportunitySidebar", () => {
  const defaultProps = {
    opportunityId: "opp-123",
    opportunityName: "New Building Project",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sidebar with opportunity name", () => {
    renderWithProviders(<OpportunitySidebar {...defaultProps} />);
    expect(screen.getByTestId("opp-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("opp-entity-name")).toHaveTextContent("New Building Project");
  });

  it("renders close button", () => {
    renderWithProviders(<OpportunitySidebar {...defaultProps} />);
    expect(screen.getByTestId("opp-close")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const { user } = renderWithProviders(<OpportunitySidebar {...defaultProps} />);
    const closeButton = screen.getByTestId("opp-close");
    closeButton.click();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("renders with null opportunityId", () => {
    renderWithProviders(<OpportunitySidebar {...defaultProps} opportunityId={null} />);
    expect(screen.getByTestId("opp-sidebar")).toBeInTheDocument();
  });
});
