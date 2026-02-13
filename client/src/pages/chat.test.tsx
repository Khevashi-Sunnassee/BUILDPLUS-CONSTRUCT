import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import ChatPage from "./chat";

vi.mock("wouter", () => ({
  useLocation: () => ["/chat", vi.fn()],
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useSearch: () => "",
  useParams: () => ({}),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Test User", email: "test@test.com", role: "admin" },
    login: vi.fn(),
    logout: vi.fn(),
  }),
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

vi.mock("emoji-picker-react", () => ({
  default: () => null,
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  DragOverlay: () => null,
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null }),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock("@/lib/image-compress", () => ({
  compressImages: vi.fn(),
}));

vi.mock("@/lib/notification-sound", () => ({
  playNotificationSound: vi.fn(),
}));

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: any[]) => mockUseQuery(...args),
    useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  };
});

describe("ChatPage", () => {
  it("renders the page with role main", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ChatPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Chat");
  });

  it("shows the chat page test id", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ChatPage />);
    expect(screen.getByTestId("chat-page")).toBeInTheDocument();
  });

  it("renders new conversation button", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ChatPage />);
    expect(screen.getByTestId("button-new-conversation")).toBeInTheDocument();
  });

  it("renders messages heading", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<ChatPage />);
    expect(screen.getByText("Messages")).toBeInTheDocument();
  });
});
