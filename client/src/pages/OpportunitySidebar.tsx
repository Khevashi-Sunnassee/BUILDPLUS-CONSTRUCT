import { OPPORTUNITY_ROUTES, JOBS_ROUTES } from "@shared/api-routes";
import { EntitySidebar, type EntityTab } from "@/components/EntitySidebar";

export function OpportunitySidebar({
  opportunityId,
  opportunityName,
  onClose,
  initialTab,
}: {
  opportunityId: string | null;
  opportunityName: string;
  onClose: () => void;
  initialTab?: EntityTab;
}) {
  return (
    <EntitySidebar
      entityId={opportunityId}
      entityName={opportunityName}
      routes={OPPORTUNITY_ROUTES}
      invalidationKeys={[[JOBS_ROUTES.OPPORTUNITIES]]}
      onClose={onClose}
      initialTab={initialTab}
      testIdPrefix="opp"
      emptyUpdatesMessage="Write a note, drop an email, or share files to get things moving"
      emptyFilesMessage="Upload files or paste screenshots to attach them"
    />
  );
}
