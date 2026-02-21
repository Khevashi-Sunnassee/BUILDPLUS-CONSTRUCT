import { Router } from "express";
import { projectsRouter } from "./projects";
import { documentsRouter } from "./documents";
import { conversationsRouter } from "./conversations";
import { membersRouter } from "./members";

const router = Router();

router.use(projectsRouter);
router.use(documentsRouter);
router.use(conversationsRouter);
router.use(membersRouter);

export { router as knowledgeBaseRouter };
