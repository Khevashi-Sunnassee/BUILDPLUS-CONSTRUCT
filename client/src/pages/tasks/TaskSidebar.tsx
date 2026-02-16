import { TASKS_ROUTES } from "@shared/api-routes";
import { EntitySidebar, type EntityTab } from "@/components/EntitySidebar";
import type { Task } from "./types";

export function TaskSidebar({
  task,
  onClose,
  initialTab,
}: {
  task: Task | null;
  onClose: () => void;
  initialTab?: EntityTab;
}) {
  return (
    <EntitySidebar
      entityId={task?.id?.toString() || null}
      entityName={task?.title || "Task"}
      routes={TASKS_ROUTES}
      invalidationKeys={[[TASKS_ROUTES.GROUPS]]}
      onClose={onClose}
      initialTab={initialTab}
      testIdPrefix="task"
      emptyUpdatesMessage="Write a note, drop an email, or share files to get things moving"
      emptyFilesMessage="Upload files or paste screenshots to attach them"
    />
  );
}
