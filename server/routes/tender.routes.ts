import { Router } from "express";
import tenderCrudRouter from "./tender/crud";
import tenderSubmissionsRouter from "./tender/submissions";
import tenderJobTendersRouter from "./tender/job-tenders";
import tenderPackagesMembersRouter from "./tender/packages-members";
import tenderInvitationsRouter from "./tender/invitations";
import tenderSuppliersRouter from "./tender/suppliers";
import tenderNotesFilesRouter from "./tender/notes-files";
import tenderMemberTrackingRouter from "./tender/member-tracking";

const router = Router();

router.use(tenderCrudRouter);
router.use(tenderSubmissionsRouter);
router.use(tenderJobTendersRouter);
router.use(tenderPackagesMembersRouter);
router.use(tenderInvitationsRouter);
router.use(tenderSuppliersRouter);
router.use(tenderNotesFilesRouter);
router.use(tenderMemberTrackingRouter);

export const tenderRouter = router;
