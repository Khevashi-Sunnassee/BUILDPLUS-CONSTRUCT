import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { scopes, scopeItems, scopeTrades, jobTypes, users } from "@shared/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { emailService } from "../../services/email.service";
import { buildBrandedEmail } from "../../lib/email-template";
import { isValidId } from "./shared";

const router = Router();

router.post("/api/scopes/email", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const emailSchema = z.object({
      scopeIds: z.array(z.string()).min(1, "At least one scope ID is required"),
      recipientEmail: z.string().email("Valid email is required"),
    });
    const { scopeIds, recipientEmail } = emailSchema.parse(req.body);

    const scopeResults = await db
      .select({
        scope: scopes,
        tradeName: scopeTrades.name,
      })
      .from(scopes)
      .leftJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .where(and(
        inArray(scopes.id, scopeIds),
        eq(scopes.companyId, companyId)
      ))
      .limit(1000);

    if (scopeResults.length === 0) {
      return res.status(404).json({ message: "No scopes found" });
    }

    let scopeBodyHtml = "";

    for (const row of scopeResults) {
      const items = await db
        .select()
        .from(scopeItems)
        .where(and(eq(scopeItems.scopeId, row.scope.id), eq(scopeItems.companyId, companyId)))
        .orderBy(asc(scopeItems.sortOrder))
        .limit(1000);

      scopeBodyHtml += `
        <h3 style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">${row.scope.name} - ${row.tradeName || "Unknown Trade"}</h3>
        <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">${row.scope.description || ""}</p>
        <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"><strong>Status:</strong> ${row.scope.status}</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="text-align: left; padding: 6px 8px; border: 1px solid #ddd;">Category</th>
              <th style="text-align: left; padding: 6px 8px; border: 1px solid #ddd;">Description</th>
              <th style="text-align: left; padding: 6px 8px; border: 1px solid #ddd;">Details</th>
              <th style="text-align: center; padding: 6px 8px; border: 1px solid #ddd;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${item.category || "-"}</td>
                <td>${item.description}</td>
                <td>${item.details || "-"}</td>
                <td style="text-align: center;">${item.status}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    const htmlContent = await buildBrandedEmail({
      title: "Scope of Works",
      body: scopeBodyHtml,
      companyId,
    });

    await emailService.sendEmail(
      recipientEmail,
      `Scope of Works - ${scopeResults.map(r => r.scope.name).join(", ")}`,
      htmlContent,
    );

    res.json({ message: "Email sent successfully" });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error emailing scopes");
    res.status(500).json({ message: "Failed to send scope email" });
  }
});

router.get("/api/scopes/:id/print", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    const [scope] = await db
      .select({
        scope: scopes,
        tradeName: scopeTrades.name,
        jobTypeName: jobTypes.name,
        createdByName: users.name,
      })
      .from(scopes)
      .leftJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .leftJoin(jobTypes, eq(scopes.jobTypeId, jobTypes.id))
      .leftJoin(users, eq(scopes.createdById, users.id))
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)))
      .limit(1);

    if (!scope) return res.status(404).json({ message: "Scope not found" });

    const items = await db
      .select()
      .from(scopeItems)
      .where(and(eq(scopeItems.scopeId, id), eq(scopeItems.companyId, companyId)))
      .orderBy(asc(scopeItems.sortOrder))
      .limit(1000);

    const categories = new Map<string, typeof items>();
    for (const item of items) {
      const cat = item.category || "Uncategorized";
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(item);
    }

    let categoriesHtml = "";
    for (const [category, catItems] of categories) {
      categoriesHtml += `
        <h3 style="margin-top: 20px; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">${category}</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.4;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="text-align: left; padding: 6px 8px; border: 1px solid #ddd; width: 5%; font-weight: 600;">#</th>
              <th style="text-align: left; padding: 6px 8px; border: 1px solid #ddd; width: 40%; font-weight: 600;">Description</th>
              <th style="text-align: left; padding: 6px 8px; border: 1px solid #ddd; width: 40%; font-weight: 600;">Details</th>
              <th style="text-align: center; padding: 6px 8px; border: 1px solid #ddd; width: 15%; font-weight: 600;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${catItems.map((item, idx) => `
              <tr>
                <td style="padding: 5px 8px; border: 1px solid #ddd;">${idx + 1}</td>
                <td style="padding: 5px 8px; border: 1px solid #ddd;">${item.description}</td>
                <td style="padding: 5px 8px; border: 1px solid #ddd; color: #6b7280; font-size: 0.9em;">${item.details || "-"}</td>
                <td style="padding: 5px 8px; border: 1px solid #ddd; text-align: center;">
                  <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.85em; background-color: ${item.status === "INCLUDED" ? "#dcfce7" : item.status === "EXCLUDED" ? "#fef2f2" : "#f3f4f6"}; color: ${item.status === "INCLUDED" ? "#166534" : item.status === "EXCLUDED" ? "#991b1b" : "#6b7280"};">
                    ${item.status}
                  </span>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Scope of Works - ${scope.scope.name}</title>
  <style>
    body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #1f2937; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print { body { padding: 0; } }
    table { border-collapse: collapse; }
    th, td { page-break-inside: avoid; }
    tr { page-break-inside: avoid; break-inside: avoid; }
  </style>
</head>
<body>
  <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; color: #1f2937;">Scope of Works</h1>
    <h2 style="margin: 4px 0 0; color: #4b5563; font-weight: normal;">${scope.scope.name}</h2>
  </div>

  <table style="width: 100%; margin-bottom: 24px;">
    <tr>
      <td style="padding: 4px 0;"><strong>Trade:</strong> ${scope.tradeName || "-"}</td>
      <td style="padding: 4px 0;"><strong>Job Type:</strong> ${scope.jobTypeName || "-"}</td>
    </tr>
    <tr>
      <td style="padding: 4px 0;"><strong>Status:</strong> ${scope.scope.status}</td>
      <td style="padding: 4px 0;"><strong>Created By:</strong> ${scope.createdByName || "-"}</td>
    </tr>
    <tr>
      <td style="padding: 4px 0;"><strong>Source:</strong> ${scope.scope.source}</td>
      <td style="padding: 4px 0;"><strong>Template:</strong> ${scope.scope.isTemplate ? "Yes" : "No"}</td>
    </tr>
  </table>

  ${scope.scope.description ? `<p style="color: #4b5563; margin-bottom: 24px;">${scope.scope.description}</p>` : ""}

  <p style="color: #6b7280; font-size: 0.9em;">Total Items: ${items.length} | Included: ${items.filter(i => i.status === "INCLUDED").length} | Excluded: ${items.filter(i => i.status === "EXCLUDED").length} | N/A: ${items.filter(i => i.status === "NA").length}</p>

  ${categoriesHtml}

  <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 0.85em;">
    <p>Generated on ${new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })}</p>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating printable scope");
    res.status(500).json({ message: "Failed to generate printable scope" });
  }
});

export default router;
