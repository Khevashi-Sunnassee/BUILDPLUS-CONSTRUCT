import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import TasksPage from "./tasks";

vi.mock("wouter", () => ({
  useLocation: () => ["/tasks", vi.fn()],
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

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  DragOverlay: () => null,
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null }),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  closestCenter: vi.fn(),
  pointerWithin: vi.fn().mockReturnValue([]),
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

describe("TasksPage", () => {
  it("shows loading state with aria-busy", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<TasksPage />);
    const busyContainer = document.querySelector("[aria-busy='true']");
    expect(busyContainer).toBeInTheDocument();
  });

  it("renders with role main and aria-label Tasks", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<TasksPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-label", "Tasks");
  });

  it("renders tasks page test id", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<TasksPage />);
    expect(screen.getByTestId("tasks-page")).toBeInTheDocument();
  });

  it("renders page title", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<TasksPage />);
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });
});
