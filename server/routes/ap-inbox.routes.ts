import { Router } from "express";
import { registerSettingsRoutes } from "./ap-inbox/settings.routes";
import { registerEmailsRoutes } from "./ap-inbox/emails.routes";
import { registerWebhookRoutes } from "./ap-inbox/webhook.routes";

const router = Router();

registerSettingsRoutes(router);
registerEmailsRoutes(router);
registerWebhookRoutes(router);

export { router as apInboxRouter };
