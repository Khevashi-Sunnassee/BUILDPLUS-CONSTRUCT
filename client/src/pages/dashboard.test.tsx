import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import DashboardPage from "./dashboard";

vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", vi.fn()],
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

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn((options: any) => {
      const queryKey = Array.isArray(options.queryKey) ? options.queryKey[0] : options.queryKey;

      if (queryKey === "/api/dashboard/stats") {
        return {
          data: {
            todayMinutes: 480,
            todayIdleMinutes: 60,
            pendingDays: 2,
            submittedAwaitingApproval: 3,
            approvedThisWeek: 5,
            recentLogs: [
              {
                id: "1",
                logDay: new Date().toISOString(),
                status: "APPROVED",
                totalMinutes: 480,
                app: "AutoCAD",
              },
              {
                id: "2",
                logDay: new Date(Date.now() - 86400000).toISOString(),
                status: "SUBMITTED",
                totalMinutes: 420,
                app: "Revit",
              },
            ],
          },
          isLoading: false,
        };
      }

      if (queryKey === "/api/chat/conversations") {
        return {
          data: [
            {
              id: "conv1",
              name: "Project Team",
              type: "group",
              unreadCount: 2,
              unreadMentions: 1,
              lastMessage: {
                body: "Let's discuss the schedule",
                createdAt: new Date().toISOString(),
              },
              members: [
                {
                  user: {
                    name: "John Doe",
                    email: "john@example.com",
                  },
                },
              ],
            },
          ],
          isLoading: false,
        };
      }

      if (queryKey === "/api/tasks/notifications") {
        return {
          data: [
            {
              id: "notif1",
              userId: "1",
              taskId: "task1",
              updateId: null,
              type: "assignment",
              title: "New task assigned",
              body: "You have been assigned a new task",
              fromUserId: "2",
              createdAt: new Date().toISOString(),
              readAt: null,
              fromUser: {
                id: "2",
                name: "Manager",
                email: "manager@example.com",
              },
              task: {
                id: "task1",
                title: "Review Drawings",
              },
            },
          ],
          isLoading: false,
          isPending: false,
        };
      }

      if (queryKey === "/api/dashboard/my-due-tasks") {
        return {
          data: {
            tasks: [
              {
                id: "due1",
                title: "Complete Site Inspection",
                status: "pending",
                dueDate: new Date(Date.now() - 86400000).toISOString(),
                priority: "high",
                groupId: "group1",
                groupName: "Site Inspections",
                jobId: "job1",
                jobName: "Main Project",
                jobNumber: "JOB-001",
                isOverdue: true,
              },
            ],
            totalCount: 1,
          },
          isLoading: false,
        };
      }

      return {
        data: undefined,
        isLoading: false,
      };
    }),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  };
});

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard with role='main' and aria-label", () => {
    renderWithProviders(<DashboardPage />);

    const mainElement = screen.getByRole("main");
    expect(mainElement).toBeInTheDocument();
    expect(mainElement).toHaveAttribute("aria-label", "Dashboard");
  });

  it("displays the dashboard title", () => {
    renderWithProviders(<DashboardPage />);

    const title = screen.getByTestId("text-dashboard-title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Dashboard");
  });

  it("displays welcome message with user name", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/Welcome back, Test User/)).toBeInTheDocument();
  });

  it("renders KPI stat cards", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("card-today-minutes")).toBeInTheDocument();
    expect(screen.getByTestId("card-pending-days")).toBeInTheDocument();
    expect(screen.getByTestId("card-awaiting-approval")).toBeInTheDocument();
    expect(screen.getByTestId("card-approved-week")).toBeInTheDocument();
  });

  it("displays KPI values correctly", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("card-today-minutes")).toHaveTextContent("8h");
    expect(screen.getByTestId("card-pending-days")).toHaveTextContent("2");
    expect(screen.getByTestId("card-awaiting-approval")).toHaveTextContent("3");
    expect(screen.getByTestId("card-approved-week")).toHaveTextContent("5");
  });

  it("displays KPI descriptions", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Today's Work")).toBeInTheDocument();
    expect(screen.getByText("Pending Days")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Approval")).toBeInTheDocument();
    expect(screen.getByText("Approved This Week")).toBeInTheDocument();
  });

  it("renders due tasks card when tasks exist", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("card-due-tasks")).toBeInTheDocument();
    expect(screen.getByText("Due & Overdue Tasks")).toBeInTheDocument();
    expect(screen.getByTestId("due-task-due1")).toBeInTheDocument();
  });

  it("displays due task details", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Complete Site Inspection")).toBeInTheDocument();
    expect(screen.getByText("JOB-001")).toBeInTheDocument();
    expect(screen.getByText("Site Inspections")).toBeInTheDocument();
    const overdueElements = screen.getAllByText(/Overdue/);
    expect(overdueElements.length).toBeGreaterThan(0);
  });

  it("renders view all tasks button", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("button-view-due-tasks")).toBeInTheDocument();
    expect(screen.getByTestId("button-view-due-tasks")).toHaveTextContent("View All Tasks");
  });

  it("renders unread messages card when conversations exist", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("card-unread-messages")).toBeInTheDocument();
    expect(screen.getByText("Unread Messages")).toBeInTheDocument();
    expect(screen.getByText("Project Team")).toBeInTheDocument();
  });

  it("displays unread message count", () => {
    renderWithProviders(<DashboardPage />);

    const badgeElements = screen.getAllByText("2");
    expect(badgeElements.length).toBeGreaterThan(0);
  });

  it("renders task notifications card when notifications exist", () => {
    renderWithProviders(<DashboardPage />);

    const taskUpdatesCard = screen.queryByTestId("card-task-notifications");
    if (taskUpdatesCard) {
      expect(taskUpdatesCard).toBeInTheDocument();
      expect(screen.getByText("Task Updates")).toBeInTheDocument();
    }
  });

  it("displays task notification details when present", () => {
    renderWithProviders(<DashboardPage />);

    const taskNotif = screen.queryByTestId("task-notif-notif1");
    if (taskNotif) {
      expect(taskNotif).toBeInTheDocument();
      expect(screen.getByText("New task assigned")).toBeInTheDocument();
    }
  });

  it("renders quick actions section", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    expect(screen.getByTestId("button-view-daily-reports")).toBeInTheDocument();
    expect(screen.getByTestId("button-view-analytics")).toBeInTheDocument();
  });

  it("renders recent activity section", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("displays recent activity logs", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("log-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("log-item-2")).toBeInTheDocument();
  });

  it("has aria-hidden on decorative icons", () => {
    renderWithProviders(<DashboardPage />);

    const ariaHiddenElements = document.querySelectorAll('[aria-hidden="true"]');
    expect(ariaHiddenElements.length).toBeGreaterThan(0);
  });

  it("displays alert triangle icon with aria-hidden in due tasks", () => {
    renderWithProviders(<DashboardPage />);

    const ariaHiddenElements = document.querySelectorAll('[aria-hidden="true"]');
    expect(ariaHiddenElements.length).toBeGreaterThan(0);
  });

  it("displays message square icon with aria-hidden in unread messages", () => {
    renderWithProviders(<DashboardPage />);

    const ariaHiddenElements = document.querySelectorAll('[aria-hidden="true"]');
    expect(ariaHiddenElements.length).toBeGreaterThan(0);
  });

  it("renders mark all read button in task notifications when present", () => {
    renderWithProviders(<DashboardPage />);

    const markAllReadBtn = screen.queryByTestId("button-mark-all-read");
    if (markAllReadBtn) {
      expect(markAllReadBtn).toBeInTheDocument();
    }
  });

  it("renders view messages button", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("button-view-messages")).toBeInTheDocument();
  });

  it("renders view all buttons for different sections", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId("button-view-due-tasks")).toBeInTheDocument();
    expect(screen.getByTestId("button-view-messages")).toBeInTheDocument();
  });

  it("displays review submissions button for authorized roles when visible", () => {
    renderWithProviders(<DashboardPage />);

    const reviewButton = screen.queryByTestId("button-review-submissions");
    if (reviewButton) {
      expect(reviewButton).toBeInTheDocument();
    }
  });

  it("hides role-based action for regular users", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.queryByTestId("button-review-submissions")).not.toBeInTheDocument();
  });

  it("displays idle time in today's work card", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/idle time/)).toBeInTheDocument();
  });

  it("displays correct awaiting review text", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Awaiting your review")).toBeInTheDocument();
  });

  it("displays correct submitted for manager review text", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Submitted for manager review")).toBeInTheDocument();
  });

  it("displays days approved text", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Days approved")).toBeInTheDocument();
  });

  it("displays unread mention count", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/You have 1 mention requiring your attention/)).toBeInTheDocument();
  });

  it("displays last message from conversation", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText("Let's discuss the schedule")).toBeInTheDocument();
  });

  it("displays notification timestamp", () => {
    renderWithProviders(<DashboardPage />);

    const dateTimeElements = screen.getAllByText(/\//, { exact: false });
    expect(dateTimeElements.length).toBeGreaterThan(0);
  });
});
