import { Router } from "express";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import { advancePanelLifecycleIfLower, updatePanelLifecycleStatus } from "../../services/panel-audit.service";
import { emailService } from "../../services/email.service";
import { buildBrandedEmail } from "../../lib/email-template";
import { sendSuccess, sendBadRequest, sendNotFound, sendForbidden, sendServerError, sendError } from "../../lib/api-response";
import { PANEL_LIFECYCLE_STATUS, insertDeliveryRecordSchema } from "@shared/schema";
import type { JobPhase } from "@shared/job-phases";

const router = Router();

// =============== DELIVERY RECORDS ===============

router.get("/api/load-lists/:id/delivery", requireAuth, async (req, res) => {
  if (req.companyId) {
    const loadList = await storage.getLoadList(req.params.id as string);
    if (loadList?.jobId) {
      const job = await storage.getJob(loadList.jobId);
      if (!job || job.companyId !== req.companyId) return sendForbidden(res);
    }
  }
  const record = await storage.getDeliveryRecord(req.params.id as string);
  sendSuccess(res, record || null);
});

router.post("/api/load-lists/:id/delivery", requireAuth, async (req, res) => {
  try {
    const loadListForPhaseCheck = await storage.getLoadList(req.params.id as string);
    if (req.companyId && loadListForPhaseCheck?.jobId) {
      const jobCheck = await storage.getJob(loadListForPhaseCheck.jobId);
      if (!jobCheck || jobCheck.companyId !== req.companyId) return sendForbidden(res);
    }
    if (loadListForPhaseCheck?.jobId) {
      const { jobHasCapability } = await import("@shared/job-phases");
      const job = await storage.getJob(loadListForPhaseCheck.jobId);
      if (job) {
        const { intToPhase } = await import("@shared/job-phases");
        const phase = (typeof job.jobPhase === 'number' ? intToPhase(job.jobPhase) : (job.jobPhase || "CONTRACTED")) as string;
        if (!jobHasCapability(phase as JobPhase, "DELIVER_PANELS")) {
          return sendForbidden(res, `Cannot record deliveries while job is in "${phase}" phase`);
        }
      }
    }
    const record = await storage.createDeliveryRecord({
      ...req.body,
      loadListId: req.params.id as string,
      enteredById: req.session.userId!,
    });
    const loadList = await storage.getLoadList(req.params.id as string);
    if (loadList?.panels) {
      for (const lp of loadList.panels) {
        advancePanelLifecycleIfLower(lp.panel.id, PANEL_LIFECYCLE_STATUS.SHIPPED, "Delivered to site", req.session.userId, { loadListId: req.params.id });
      }
    }
    sendSuccess(res, record);
  } catch (error: unknown) {
    sendBadRequest(res, error instanceof Error ? error.message : "Failed to create delivery record");
  }
});

router.put("/api/delivery-records/:id", requireAuth, async (req, res) => {
  const record = await storage.getDeliveryRecordById(req.params.id as string);
  if (!record) {
    return sendNotFound(res, "Delivery record not found");
  }
  const loadList = await storage.getLoadList(record.loadListId);
  const companyId = req.session.companyId;
  if (!loadList || (loadList as unknown as Record<string, unknown>).companyId !== companyId) {
    return sendNotFound(res, "Delivery record not found");
  }
  const parsed = insertDeliveryRecordSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return sendBadRequest(res, "Validation failed");
  }
  const updated = await storage.updateDeliveryRecord(req.params.id as string, parsed.data);
  sendSuccess(res, updated);
});

// =============== LOAD RETURNS ===============

router.get("/api/load-lists/:id/return", requireAuth, async (req, res) => {
  try {
    if (req.companyId) {
      const loadList = await storage.getLoadList(req.params.id as string);
      if (loadList?.jobId) {
        const job = await storage.getJob(loadList.jobId);
        if (!job || job.companyId !== req.companyId) return sendForbidden(res);
      }
    }
    const loadReturn = await storage.getLoadReturn(req.params.id as string);
    sendSuccess(res, loadReturn || null);
  } catch (error: unknown) {
    sendServerError(res, error instanceof Error ? error.message : "Failed to get load return");
  }
});

router.post("/api/load-lists/:id/return", requireAuth, async (req, res) => {
  try {
    const loadList = await storage.getLoadList(req.params.id as string);
    if (!loadList) return sendNotFound(res, "Load list not found");
    if (req.companyId && loadList.jobId) {
      const job = await storage.getJob(loadList.jobId);
      if (!job || job.companyId !== req.companyId) return sendForbidden(res);
    }

    const existingReturn = await storage.getLoadReturn(req.params.id as string);
    if (existingReturn) {
      return sendBadRequest(res, "A return record already exists for this load list");
    }

    const { panelIds, ...returnData } = req.body;

    if (!returnData.returnReason) {
      return sendBadRequest(res, "Return reason is required");
    }

    if (!returnData.returnType || !["FULL", "PARTIAL"].includes(returnData.returnType)) {
      return sendBadRequest(res, "Return type must be FULL or PARTIAL");
    }

    if (returnData.returnType === "PARTIAL" && (!panelIds || panelIds.length === 0)) {
      return sendBadRequest(res, "At least one panel must be selected for partial return");
    }

    const selectedPanelIds = returnData.returnType === "FULL"
      ? loadList.panels.map(p => p.panel.id)
      : (panelIds || []);

    const loadReturn = await storage.createLoadReturn({
      ...returnData,
      loadListId: req.params.id as string,
      returnedById: req.session.userId || undefined,
    }, selectedPanelIds);

    for (const panelId of selectedPanelIds) {
      updatePanelLifecycleStatus(panelId, PANEL_LIFECYCLE_STATUS.RETURNED, "Panel returned from site", req.session.userId, { returnType: returnData.returnType, returnReason: returnData.returnReason });
    }

    sendSuccess(res, loadReturn);
  } catch (error: unknown) {
    sendBadRequest(res, error instanceof Error ? error.message : "Failed to create load return");
  }
});

// =============== TEST EMAIL ROUTES ===============

router.post("/api/test-gmail", requireAuth, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return sendBadRequest(res, "Recipient email required");
    const companyId = req.session?.companyId || req.companyId;
    const htmlBody = await buildBrandedEmail({
      title: "Test Email",
      body: `<p>This is a test email sent from the BuildPlus Ai system.</p>
      <p><strong>Sent at:</strong> ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })}</p>`,
      companyId,
    });
    const result = await emailService.sendEmail(
      to,
      "Test Email from BuildPlus Ai System",
      htmlBody
    );
    sendSuccess(res, result);
  } catch (error: unknown) {
    sendServerError(res, error instanceof Error ? error.message : String(error));
  }
});

router.post("/api/test-all-emails", requireAuth, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return sendBadRequest(res, "Recipient email required");
    const companyId = req.session?.companyId || req.companyId;
    const senderName = req.session?.name || "Admin User";
    const timestamp = new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" });

    if (!emailService.isConfigured()) {
      return sendError(res, 503, "Email service is not configured");
    }

    const results: Array<{ emailType: string; success: boolean; error?: string }> = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. Basic Test Email
    try {
      const html = await buildBrandedEmail({
        title: "Test Email",
        body: `<p>This is a test email sent from the BuildPlus Ai system.</p>
          <p><strong>Sent at:</strong> ${timestamp}</p>`,
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] Basic System Email", html);
      results.push({ emailType: "Basic Test Email", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Basic Test Email", success: false, error: e.message }); }
    await delay(600);

    // 2. User Invitation Email
    try {
      const html = await buildBrandedEmail({
        title: "You've Been Invited",
        body: `<p>${senderName} has invited you to join <strong>Sample Company Pty Ltd</strong> on the BuildPlus Ai Management System.</p>
          <p>Click the button below to set up your account. This link will expire in 7 days.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="#" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
              Set Up Your Account
            </a>
          </div>
          <p style="color: #888; font-size: 13px; line-height: 1.5;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="#" style="color: #2563eb;">https://example.com/register/sample-token-123</a>
          </p>`,
        footerNote: `You're receiving this email because ${senderName} invited you to join Sample Company Pty Ltd. If you weren't expecting this invitation, you can safely ignore this email.`,
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] You're invited to join Sample Company on BuildPlus Ai", html);
      results.push({ emailType: "User Invitation", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "User Invitation", success: false, error: e.message }); }
    await delay(600);

    // 3. Tender Invitation Email
    try {
      const html = await buildBrandedEmail({
        title: "Tender Invitation",
        recipientName: "ABC Suppliers Pty Ltd",
        body: `<div style="margin-bottom: 24px;">
            <p>You are invited to submit a tender for the following project.</p>
            <p><strong>Tender Number:</strong> TND-2026-0042<br/>
            <strong>Project:</strong> Westfield Shopping Centre Expansion<br/>
            <strong>Closing Date:</strong> 15 March 2026</p>
            <p>Please review the attached documentation and submit your response by the closing date.</p>
          </div>
          <div style="margin-top: 24px; border-top: 2px solid #2563eb; padding-top: 20px;">
            <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 18px;">Tender Documents</h2>
            <p style="margin: 0 0 16px 0; color: #555; font-size: 14px;">Please review the following document bundle for this tender. You can scan the QR code or click the link below to access the documents.</p>
            <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
              <h3 style="margin: 0 0 4px 0; font-size: 16px;">Main Tender Package</h3>
              <div style="text-align: center; margin-top: 12px;">
                <a href="#" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">View Tender Documents</a>
              </div>
            </div>
          </div>`,
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] Tender Invitation - TND-2026-0042: Westfield Shopping Centre", html);
      results.push({ emailType: "Tender Invitation", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Tender Invitation", success: false, error: e.message }); }
    await delay(600);

    // 4. Tender Document Update Notice
    try {
      const html = await buildBrandedEmail({
        title: "Document Update Notice",
        recipientName: "ABC Suppliers Pty Ltd",
        body: `<p>Please be advised that the following documents have been updated for tender <strong>TND-2026-0042 - Westfield Shopping Centre Expansion</strong>:</p>
          <ul>
            <li><strong>Structural Drawings Rev B</strong> (DOC-0088) — updated from v1 to v2</li>
            <li><strong>Bill of Quantities</strong> (DOC-0092) — updated from v3 to v4</li>
            <li><strong>Site Plan</strong> (DOC-0095)</li>
          </ul>
          <p>Please ensure you are referencing the latest versions when preparing your submission.</p>`,
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] Document Update - Tender TND-2026-0042: Westfield Shopping Centre", html);
      results.push({ emailType: "Tender Document Update Notice", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Tender Document Update Notice", success: false, error: e.message }); }
    await delay(600);

    // 5. Job Invitation Email
    try {
      const html = await buildBrandedEmail({
        title: "Job Invitation",
        recipientName: "Colin",
        body: `<p><strong>${senderName}</strong> has added you to the following job:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold; width: 140px;">Job Number</td>
              <td style="padding: 8px 12px; background: white;">JOB-2026-0158</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Job Name</td>
              <td style="padding: 8px 12px; background: white;">Greenfield Residential Tower</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Address</td>
              <td style="padding: 8px 12px; background: white;">45 Collins Street, Melbourne VIC 3000</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Client</td>
              <td style="padding: 8px 12px; background: white;">Greenfield Development Group</td>
            </tr>
          </table>
          <p>You now have access to documents and files associated with this job.</p>`,
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] You've been added to Job: JOB-2026-0158 - Greenfield Residential Tower", html);
      results.push({ emailType: "Job Invitation", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Job Invitation", success: false, error: e.message }); }
    await delay(600);

    // 6. Purchase Order Email
    try {
      const html = await buildBrandedEmail({
        title: "Purchase Order: PO-2026-0312",
        subtitle: `Sent by ${senderName}`,
        body: `<p>Please find attached Purchase Order PO-2026-0312 for the supply of the following items:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background: #e2e8f0;">
              <th style="padding: 8px 12px; text-align: left;">Item</th>
              <th style="padding: 8px 12px; text-align: left;">Qty</th>
              <th style="padding: 8px 12px; text-align: right;">Amount</th>
            </tr>
            <tr>
              <td style="padding: 8px 12px;">Precast Concrete Panels - Type A</td>
              <td style="padding: 8px 12px;">24</td>
              <td style="padding: 8px 12px; text-align: right;">$48,000.00</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px;">Steel Reinforcement Mesh</td>
              <td style="padding: 8px 12px;">50</td>
              <td style="padding: 8px 12px; text-align: right;">$12,500.00</td>
            </tr>
            <tr style="border-top: 2px solid #334155;">
              <td colspan="2" style="padding: 8px 12px; font-weight: bold;">Total (ex GST)</td>
              <td style="padding: 8px 12px; text-align: right; font-weight: bold;">$60,500.00</td>
            </tr>
          </table>
          <p>Please confirm receipt and expected delivery schedule at your earliest convenience.</p>`,
        footerNote: "Please review the attached purchase order. If you have any questions, reply directly to this email.",
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] Purchase Order: PO-2026-0312", html);
      results.push({ emailType: "Purchase Order", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Purchase Order", success: false, error: e.message }); }
    await delay(600);

    // 7. Documents Shared Email
    try {
      const attachmentSummary = `
        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #334155;">3 Documents Attached:</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
          <tr style="background-color: #e2e8f0;">
            <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">Title</td>
            <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">File</td>
            <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">Rev</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px; font-size: 13px; color: #334155;">Structural Engineering Report</td>
            <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">structural-report-v2.pdf</td>
            <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">B</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px; font-size: 13px; color: #334155;">Site Survey Plan</td>
            <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">site-survey-2026.pdf</td>
            <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">A</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px; font-size: 13px; color: #334155;">Safety Management Plan</td>
            <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">safety-plan.pdf</td>
            <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">C</td>
          </tr>
        </table>`;
      const html = await buildBrandedEmail({
        title: "Documents Shared With You",
        subtitle: `Sent by ${senderName}`,
        body: `<p>Please find the following documents attached for your review regarding the Greenfield Residential Tower project.</p>
          <p>These documents are required for the upcoming site inspection scheduled for 20 February 2026.</p>`,
        attachmentSummary,
        footerNote: "Please download the attached documents. If you have any questions, reply directly to this email.",
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] Documents Shared - Greenfield Residential Tower", html);
      results.push({ emailType: "Documents Shared", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Documents Shared", success: false, error: e.message }); }
    await delay(600);

    // 8. Document Bundle Update Notice
    try {
      const html = await buildBrandedEmail({
        title: "Document Bundle Update Notice",
        recipientName: "Colin",
        body: `<p>Please be advised that the following documents in bundle <strong>Main Construction Package</strong> have been updated:</p>
          <ul>
            <li><strong>Architectural Drawings</strong> (DOC-0201) — updated from v2 to v3</li>
            <li><strong>Mechanical Services Spec</strong> (DOC-0215) — updated from v1 to v2</li>
          </ul>
          <p>Please ensure you are referencing the latest versions of these documents.</p>`,
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] Document Bundle Update - Main Construction Package", html);
      results.push({ emailType: "Document Bundle Update", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Document Bundle Update", success: false, error: e.message }); }
    await delay(600);

    // 9. PM Call Log Email
    try {
      const html = await buildBrandedEmail({
        title: "PM Call Log — Greenfield Residential Tower",
        body: `<p><strong>Call Date:</strong> 15 Feb 2026, 2:30 PM</p>
          <p><strong>Contact:</strong> James Wilson (0412 345 678)</p>
          <p><strong>Logged By:</strong> ${senderName}</p>
          <p><strong>Notification Sent To:</strong> Management, Production</p>
          <h3 style="margin-top:20px;">Late Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #fef2f2;">
              <td style="padding: 6px 10px; font-weight: bold; color: #dc2626;">Level 3 - Zone A</td>
              <td style="padding: 6px 10px;">5 days behind schedule</td>
            </tr>
            <tr style="background: #fff7ed;">
              <td style="padding: 6px 10px; font-weight: bold; color: #ea580c;">Level 4 - Zone B</td>
              <td style="padding: 6px 10px;">2 days behind schedule</td>
            </tr>
          </table>
          <h3 style="margin-top:20px;">Concerns & Issues</h3>
          <ul>
            <li><strong>Client Design Changes:</strong> Client has requested modifications to Level 5 facade panels</li>
            <li><strong>Installation Problems:</strong> Crane access restricted due to adjacent site works on Wednesday</li>
          </ul>
          <h3 style="margin-top:20px;">Logistics</h3>
          <ul>
            <li><strong>Delivery Time:</strong> 6:00 AM</li>
            <li><strong>Next Delivery:</strong> 18 Feb 2026</li>
          </ul>
          <h3 style="margin-top:20px;">Notes</h3>
          <p>Site foreman confirmed Level 2 panels are complete and ready for inspection. Need to schedule crane for Level 3 panels next week.</p>
          <p style="margin-top:16px;padding:8px 12px;background:#fef3c7;border-radius:4px;"><strong>Production schedule has been updated</strong> based on reported delays.</p>`,
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] PM Call Log: Greenfield Residential Tower — 15/02/2026 [2 LATE]", html);
      results.push({ emailType: "PM Call Log", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "PM Call Log", success: false, error: e.message }); }
    await delay(600);

    // 10. Hire Booking Email
    try {
      const html = await buildBrandedEmail({
        title: "Equipment Hire Booking - HB-2026-0089",
        body: `<p>Please confirm the following equipment hire booking:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold; width: 160px;">Booking Number</td>
              <td style="padding: 8px 12px; background: white;">HB-2026-0089</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Equipment</td>
              <td style="padding: 8px 12px; background: white;">50T Mobile Crane</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Supplier</td>
              <td style="padding: 8px 12px; background: white;">National Crane Hire</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Job</td>
              <td style="padding: 8px 12px; background: white;">JOB-2026-0158 - Greenfield Residential Tower</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Start Date</td>
              <td style="padding: 8px 12px; background: white;">20 Feb 2026</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">End Date</td>
              <td style="padding: 8px 12px; background: white;">28 Feb 2026</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Daily Rate</td>
              <td style="padding: 8px 12px; background: white;">$2,800.00</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Requested By</td>
              <td style="padding: 8px 12px; background: white;">${senderName}</td>
            </tr>
          </table>
          <p>Please confirm availability and any special requirements for site access.</p>`,
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] Equipment Hire Booking HB-2026-0089", html);
      results.push({ emailType: "Hire Booking", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Hire Booking", success: false, error: e.message }); }
    await delay(600);

    // 11. Task Notification Email
    try {
      const html = await buildBrandedEmail({
        title: "Task Notification",
        subtitle: `Sent by ${senderName}`,
        body: `<p>You have been assigned a new task:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold; width: 140px;">Task</td>
              <td style="padding: 8px 12px; background: white;">Review Level 3 panel shop drawings</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Job</td>
              <td style="padding: 8px 12px; background: white;">JOB-2026-0158 - Greenfield Residential Tower</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Due Date</td>
              <td style="padding: 8px 12px; background: white;">22 Feb 2026</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #e2e8f0; font-weight: bold;">Priority</td>
              <td style="padding: 8px 12px; background: white;">High</td>
            </tr>
          </table>
          <p>Please complete this task by the due date. If you have any questions, contact the project manager.</p>`,
        footerNote: "If you have any questions, reply directly to this email.",
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] Task Notification - Review Level 3 Panel Shop Drawings", html);
      results.push({ emailType: "Task Notification", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Task Notification", success: false, error: e.message }); }
    await delay(600);

    // 12. Scope of Works Email
    try {
      const html = await buildBrandedEmail({
        title: "Scope of Works",
        body: `<h3>Concrete Works - Greenfield Residential Tower</h3>
          <p><strong>Trade:</strong> Concrete<br/><strong>Status:</strong> Draft</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
            <thead>
              <tr style="background: #e2e8f0;">
                <th style="padding: 6px 10px; text-align: left;">Category</th>
                <th style="padding: 6px 10px; text-align: left;">Description</th>
                <th style="padding: 6px 10px; text-align: left;">Details</th>
                <th style="padding: 6px 10px; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 6px 10px;">Foundations</td>
                <td style="padding: 6px 10px;">Supply and install reinforced concrete footings</td>
                <td style="padding: 6px 10px;">40MPa concrete, N12 rebar</td>
                <td style="padding: 6px 10px; text-align: center;">INCLUDED</td>
              </tr>
              <tr>
                <td style="padding: 6px 10px;">Slabs</td>
                <td style="padding: 6px 10px;">Post-tensioned slab construction Levels 1-8</td>
                <td style="padding: 6px 10px;">50MPa concrete, PT cables</td>
                <td style="padding: 6px 10px; text-align: center;">INCLUDED</td>
              </tr>
              <tr>
                <td style="padding: 6px 10px;">Columns</td>
                <td style="padding: 6px 10px;">In-situ concrete columns all levels</td>
                <td style="padding: 6px 10px;">65MPa concrete</td>
                <td style="padding: 6px 10px; text-align: center;">PROVISIONAL</td>
              </tr>
            </tbody>
          </table>`,
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] Scope of Works - Concrete Works, Greenfield Residential Tower", html);
      results.push({ emailType: "Scope of Works", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Scope of Works", success: false, error: e.message }); }
    await delay(600);

    // 13. Broadcast Message Email
    try {
      const html = await buildBrandedEmail({
        title: "Broadcast Message",
        recipientName: "Colin",
        body: `<p><strong>Important Site Update</strong></p>
          <p>Please be advised that due to severe weather forecast for tomorrow (16 Feb 2026), all site operations at Greenfield Residential Tower will be suspended.</p>
          <p>Key details:</p>
          <ul>
            <li>All crane operations cancelled</li>
            <li>Site induction for new workers postponed to 17 Feb</li>
            <li>Concrete pour for Level 4 rescheduled to 18 Feb</li>
          </ul>
          <p>Please ensure all loose materials and equipment are secured before end of shift today. Contact your supervisor for any questions.</p>`,
        companyId,
      });
      const r = await emailService.sendEmail(to, "[TEST] Broadcast - Important Site Update: Weather Suspension", html);
      results.push({ emailType: "Broadcast Message", success: r.success, error: r.error });
    } catch (e: any) { results.push({ emailType: "Broadcast Message", success: false, error: e.message }); }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    sendSuccess(res, {
      totalSent: successCount,
      totalFailed: failCount,
      totalEmails: results.length,
      recipient: to,
      results,
    });
  } catch (error: unknown) {
    sendServerError(res, error instanceof Error ? error.message : String(error));
  }
});

export default router;
