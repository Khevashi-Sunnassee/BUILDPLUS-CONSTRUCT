import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { hireBookings, employees, suppliers, jobs, assets, users, companies, ASSET_CATEGORIES } from "@shared/schema";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import { emailService } from "../services/email.service";
import { format } from "date-fns";

const router = Router();

const hireBookingSchema = z.object({
  hireSource: z.enum(["internal", "external"]),
  equipmentDescription: z.string().min(1, "Equipment description is required"),
  assetCategoryIndex: z.number().int().min(0).max(ASSET_CATEGORIES.length - 1),
  assetId: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  jobId: z.string().min(1, "Job is required"),
  costCode: z.string().optional().nullable(),
  requestedByUserId: z.string().min(1, "Requested by is required"),
  responsiblePersonUserId: z.string().min(1, "Responsible person is required"),
  siteContactUserId: z.string().nullable().optional(),
  hireStartDate: z.string().min(1, "Start date is required"),
  hireEndDate: z.string().min(1, "End date is required"),
  expectedReturnDate: z.string().nullable().optional(),
  rateType: z.enum(["day", "week", "month", "custom"]),
  rateAmount: z.string().min(1, "Rate amount is required"),
  chargeRule: z.enum(["calendar_days", "business_days", "minimum_days"]).optional(),
  quantity: z.number().int().min(1).optional(),
  deliveryRequired: z.boolean().optional(),
  deliveryAddress: z.string().nullable().optional(),
  deliveryCost: z.string().nullable().optional(),
  pickupRequired: z.boolean().optional(),
  pickupCost: z.string().nullable().optional(),
  supplierReference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

async function getNextBookingNumber(companyId: string): Promise<string> {
  const result = await db
    .select({ bookingNumber: hireBookings.bookingNumber })
    .from(hireBookings)
    .where(eq(hireBookings.companyId, companyId))
    .orderBy(desc(hireBookings.createdAt))
    .limit(1);

  if (result.length === 0) {
    return "HIRE-000001";
  }

  const lastNumber = result[0].bookingNumber;
  const match = lastNumber.match(/HIRE-(\d+)/);
  if (match) {
    const next = parseInt(match[1], 10) + 1;
    return `HIRE-${String(next).padStart(6, "0")}`;
  }
  return "HIRE-000001";
}

router.get("/api/hire-bookings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    let conditions = [eq(hireBookings.companyId, companyId)];
    if (status && status !== "ALL") {
      conditions.push(eq(hireBookings.status, status as any));
    }

    const bookings = await db
      .select({
        booking: hireBookings,
        requestedBy: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
        },
        job: {
          id: jobs.id,
          name: jobs.name,
          jobNumber: jobs.jobNumber,
        },
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
        },
        approvedBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(hireBookings)
      .leftJoin(employees, eq(hireBookings.requestedByUserId, employees.id))
      .leftJoin(jobs, eq(hireBookings.jobId, jobs.id))
      .leftJoin(suppliers, eq(hireBookings.supplierId, suppliers.id))
      .leftJoin(users, eq(hireBookings.approvedByUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(hireBookings.createdAt));

    const results = bookings.map((row) => ({
      ...row.booking,
      assetCategoryName: ASSET_CATEGORIES[row.booking.assetCategoryIndex] || "Unknown",
      requestedBy: row.requestedBy,
      job: row.job,
      supplier: row.supplier,
      approvedBy: row.approvedBy,
    }));

    if (search) {
      const lower = search.toLowerCase();
      const filtered = results.filter((b) =>
        b.bookingNumber.toLowerCase().includes(lower) ||
        b.equipmentDescription.toLowerCase().includes(lower) ||
        b.assetCategoryName.toLowerCase().includes(lower) ||
        (b.supplier?.name || "").toLowerCase().includes(lower) ||
        (b.job?.jobNumber || "").toLowerCase().includes(lower) ||
        (b.job?.name || "").toLowerCase().includes(lower)
      );
      return res.json(filtered);
    }

    res.json(results);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching hire bookings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch hire bookings" });
  }
});

router.get("/api/hire-bookings/next-number", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const bookingNumber = await getNextBookingNumber(companyId);
    res.json({ bookingNumber });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error getting next hire booking number");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get next booking number" });
  }
});

router.get("/api/hire-bookings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const result = await db
      .select({
        booking: hireBookings,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
          phone: suppliers.phone,
          keyContact: suppliers.keyContact,
          addressLine1: suppliers.addressLine1,
          addressLine2: suppliers.addressLine2,
          city: suppliers.city,
          state: suppliers.state,
          postcode: suppliers.postcode,
        },
        job: {
          id: jobs.id,
          name: jobs.name,
          jobNumber: jobs.jobNumber,
        },
        requestedBy: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
        },
      })
      .from(hireBookings)
      .leftJoin(suppliers, eq(hireBookings.supplierId, suppliers.id))
      .leftJoin(jobs, eq(hireBookings.jobId, jobs.id))
      .leftJoin(employees, eq(hireBookings.requestedByUserId, employees.id))
      .where(and(eq(hireBookings.id, id), eq(hireBookings.companyId, companyId)))
      .limit(1);

    if (result.length === 0) return res.status(404).json({ error: "Hire booking not found" });

    const row = result[0];
    res.json({
      ...row.booking,
      assetCategoryName: ASSET_CATEGORIES[row.booking.assetCategoryIndex] || "Unknown",
      supplier: row.supplier,
      job: row.job,
      requestedByEmployee: row.requestedBy,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching hire booking");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch hire booking" });
  }
});

router.post("/api/hire-bookings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const parsed = hireBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const data = parsed.data;

    if (data.hireSource === "external" && !data.supplierId) {
      return res.status(400).json({ error: "Supplier is required for external hire" });
    }
    if (data.hireSource === "internal" && !data.assetId) {
      return res.status(400).json({ error: "Asset selection is required for internal hire" });
    }

    const bookingNumber = await getNextBookingNumber(companyId);

    const [booking] = await db.insert(hireBookings).values({
      companyId,
      bookingNumber,
      hireSource: data.hireSource,
      equipmentDescription: data.equipmentDescription,
      assetCategoryIndex: data.assetCategoryIndex,
      assetId: data.hireSource === "internal" ? (data.assetId || null) : null,
      supplierId: data.hireSource === "external" ? (data.supplierId || null) : null,
      jobId: data.jobId,
      costCode: data.costCode || null,
      requestedByUserId: data.requestedByUserId,
      responsiblePersonUserId: data.responsiblePersonUserId,
      siteContactUserId: data.siteContactUserId || null,
      hireStartDate: new Date(data.hireStartDate),
      hireEndDate: new Date(data.hireEndDate),
      expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
      rateType: data.rateType,
      rateAmount: data.rateAmount,
      chargeRule: data.chargeRule || "calendar_days",
      quantity: data.quantity || 1,
      deliveryRequired: data.deliveryRequired || false,
      deliveryAddress: data.deliveryAddress || null,
      deliveryCost: data.deliveryCost || null,
      pickupRequired: data.pickupRequired || false,
      pickupCost: data.pickupCost || null,
      supplierReference: data.supplierReference || null,
      notes: data.notes || null,
      status: "DRAFT",
    }).returning();

    res.status(201).json(booking);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating hire booking");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create hire booking" });
  }
});

router.patch("/api/hire-bookings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const existing = await db
      .select()
      .from(hireBookings)
      .where(and(eq(hireBookings.id, id), eq(hireBookings.companyId, companyId)))
      .limit(1);

    if (existing.length === 0) return res.status(404).json({ error: "Hire booking not found" });

    const parsed = hireBookingSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const rawStatus = req.body.status;
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (rawStatus && ["DRAFT", "REQUESTED", "APPROVED", "BOOKED", "PICKED_UP", "ON_HIRE", "RETURNED", "CANCELLED", "CLOSED"].includes(rawStatus)) {
      updateData.status = rawStatus;
    }

    if (data.hireSource !== undefined) updateData.hireSource = data.hireSource;
    if (data.equipmentDescription !== undefined) updateData.equipmentDescription = data.equipmentDescription;
    if (data.assetCategoryIndex !== undefined) updateData.assetCategoryIndex = data.assetCategoryIndex;
    if (data.assetId !== undefined) updateData.assetId = data.assetId;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.jobId !== undefined) updateData.jobId = data.jobId;
    if (data.costCode !== undefined) updateData.costCode = data.costCode;
    if (data.requestedByUserId !== undefined) updateData.requestedByUserId = data.requestedByUserId;
    if (data.responsiblePersonUserId !== undefined) updateData.responsiblePersonUserId = data.responsiblePersonUserId;
    if (data.siteContactUserId !== undefined) updateData.siteContactUserId = data.siteContactUserId;
    if (data.hireStartDate !== undefined) updateData.hireStartDate = new Date(data.hireStartDate);
    if (data.hireEndDate !== undefined) updateData.hireEndDate = new Date(data.hireEndDate);
    if (data.expectedReturnDate !== undefined) updateData.expectedReturnDate = data.expectedReturnDate ? new Date(data.expectedReturnDate) : null;
    if (data.rateType !== undefined) updateData.rateType = data.rateType;
    if (data.rateAmount !== undefined) updateData.rateAmount = data.rateAmount;
    if (data.chargeRule !== undefined) updateData.chargeRule = data.chargeRule;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.deliveryRequired !== undefined) updateData.deliveryRequired = data.deliveryRequired;
    if (data.deliveryAddress !== undefined) updateData.deliveryAddress = data.deliveryAddress;
    if (data.deliveryCost !== undefined) updateData.deliveryCost = data.deliveryCost;
    if (data.pickupRequired !== undefined) updateData.pickupRequired = data.pickupRequired;
    if (data.pickupCost !== undefined) updateData.pickupCost = data.pickupCost;
    if (data.supplierReference !== undefined) updateData.supplierReference = data.supplierReference;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [updated] = await db
      .update(hireBookings)
      .set(updateData)
      .where(and(eq(hireBookings.id, id), eq(hireBookings.companyId, companyId)))
      .returning();

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating hire booking");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update hire booking" });
  }
});

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["REQUESTED", "CANCELLED"],
  REQUESTED: ["APPROVED", "CANCELLED"],
  APPROVED: ["BOOKED", "CANCELLED"],
  BOOKED: ["PICKED_UP", "ON_HIRE", "CANCELLED"],
  PICKED_UP: ["ON_HIRE", "RETURNED"],
  ON_HIRE: ["RETURNED"],
  RETURNED: ["CLOSED"],
  CANCELLED: [],
  CLOSED: [],
};

async function transitionStatus(
  req: Request,
  res: Response,
  targetStatus: string,
  extraUpdates?: Record<string, any>
) {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const existing = await db
      .select()
      .from(hireBookings)
      .where(and(eq(hireBookings.id, id), eq(hireBookings.companyId, companyId)))
      .limit(1);

    if (existing.length === 0) return res.status(404).json({ error: "Hire booking not found" });

    const current = existing[0].status;
    const allowed = STATUS_TRANSITIONS[current] || [];

    if (!allowed.includes(targetStatus)) {
      return res.status(400).json({
        error: `Cannot transition from ${current} to ${targetStatus}`,
        allowedTransitions: allowed,
      });
    }

    const updateData: Record<string, any> = {
      status: targetStatus,
      updatedAt: new Date(),
      ...extraUpdates,
    };

    const [updated] = await db
      .update(hireBookings)
      .set(updateData)
      .where(and(eq(hireBookings.id, id), eq(hireBookings.companyId, companyId)))
      .returning();

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, `Error transitioning hire booking to ${targetStatus}`);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update status" });
  }
}

router.post("/api/hire-bookings/:id/submit", requireAuth, async (req: Request, res: Response) => {
  await transitionStatus(req, res, "REQUESTED");
});

router.post("/api/hire-bookings/:id/approve", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  const userId = req.session.userId;
  await transitionStatus(req, res, "APPROVED", {
    approvedByUserId: userId,
    approvedAt: new Date(),
  });
});

router.post("/api/hire-bookings/:id/reject", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  await transitionStatus(req, res, "CANCELLED");
});

router.post("/api/hire-bookings/:id/book", requireAuth, async (req: Request, res: Response) => {
  await transitionStatus(req, res, "BOOKED");
});

router.post("/api/hire-bookings/:id/pickup", requireAuth, async (req: Request, res: Response) => {
  await transitionStatus(req, res, "PICKED_UP");
});

router.post("/api/hire-bookings/:id/on-hire", requireAuth, async (req: Request, res: Response) => {
  await transitionStatus(req, res, "ON_HIRE");
});

router.post("/api/hire-bookings/:id/return", requireAuth, async (req: Request, res: Response) => {
  await transitionStatus(req, res, "RETURNED");
});

router.post("/api/hire-bookings/:id/cancel", requireAuth, async (req: Request, res: Response) => {
  await transitionStatus(req, res, "CANCELLED");
});

router.post("/api/hire-bookings/:id/close", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  await transitionStatus(req, res, "CLOSED");
});

router.delete("/api/hire-bookings/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const existing = await db
      .select()
      .from(hireBookings)
      .where(and(eq(hireBookings.id, id), eq(hireBookings.companyId, companyId)))
      .limit(1);

    if (existing.length === 0) return res.status(404).json({ error: "Hire booking not found" });

    if (existing[0].status !== "DRAFT") {
      return res.status(400).json({ error: "Can only delete draft bookings" });
    }

    await db.delete(hireBookings).where(and(eq(hireBookings.id, id), eq(hireBookings.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting hire booking");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete hire booking" });
  }
});

function buildHireBookingHtml(booking: any, supplier: any, job: any, requestedBy: any, companyName: string): string {
  const fmtDate = (d: any) => d ? format(new Date(d), "dd/MM/yyyy") : "-";
  const fmtCurrency = (v: any) => v ? `$${parseFloat(v).toFixed(2)}` : "-";
  const rateLabels: Record<string, string> = { day: "Per Day", week: "Per Week", month: "Per Month", custom: "Custom" };
  const chargeLabels: Record<string, string> = { calendar_days: "Calendar Days", business_days: "Business Days", minimum_days: "Minimum Days" };

  return `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #333; margin: 0; padding: 20px; }
  .header { background: #1e3a5f; color: white; padding: 24px; margin: -20px -20px 20px -20px; }
  .header h1 { margin: 0 0 4px 0; font-size: 22px; }
  .header p { margin: 0; font-size: 14px; opacity: 0.9; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 14px; font-weight: bold; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  table td { padding: 6px 8px; vertical-align: top; font-size: 13px; }
  table td:first-child { font-weight: 600; color: #555; width: 180px; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
  @media print {
    body { padding: 0; }
    .header { margin: 0 0 20px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${companyName}</h1>
    <p>Equipment Hire Booking - ${booking.bookingNumber}</p>
  </div>

  <div class="section">
    <div class="section-title">Booking Details</div>
    <table>
      <tr><td>Booking Number</td><td>${booking.bookingNumber}</td></tr>
      <tr><td>Status</td><td>${booking.status.replace(/_/g, " ")}</td></tr>
      <tr><td>Equipment Source</td><td>${booking.hireSource === "external" ? "External (Hire Company)" : "Internal"}</td></tr>
      <tr><td>Equipment Description</td><td>${booking.equipmentDescription}</td></tr>
      <tr><td>Asset Category</td><td>${ASSET_CATEGORIES[booking.assetCategoryIndex] || "Unknown"}</td></tr>
      <tr><td>Quantity</td><td>${booking.quantity || 1}</td></tr>
    </table>
  </div>

  ${supplier && supplier.id ? `
  <div class="section">
    <div class="section-title">Supplier / Hire Company</div>
    <table>
      <tr><td>Company</td><td>${supplier.name || "-"}</td></tr>
      <tr><td>Contact</td><td>${supplier.keyContact || "-"}</td></tr>
      <tr><td>Email</td><td>${supplier.email || "-"}</td></tr>
      <tr><td>Phone</td><td>${supplier.phone || "-"}</td></tr>
      ${supplier.addressLine1 ? `<tr><td>Address</td><td>${[supplier.addressLine1, supplier.addressLine2, supplier.city, supplier.state, supplier.postcode].filter(Boolean).join(", ")}</td></tr>` : ""}
      ${booking.supplierReference ? `<tr><td>Supplier Reference</td><td>${booking.supplierReference}</td></tr>` : ""}
    </table>
  </div>
  ` : ""}

  <div class="section">
    <div class="section-title">Job Details</div>
    <table>
      <tr><td>Job</td><td>${job ? `${job.jobNumber} - ${job.name}` : "-"}</td></tr>
      <tr><td>Requested By</td><td>${requestedBy ? `${requestedBy.firstName} ${requestedBy.lastName}` : "-"}</td></tr>
      ${booking.costCode ? `<tr><td>Cost Code</td><td>${booking.costCode}</td></tr>` : ""}
    </table>
  </div>

  <div class="section">
    <div class="section-title">Hire Period & Rates</div>
    <table>
      <tr><td>Start Date</td><td>${fmtDate(booking.hireStartDate)}</td></tr>
      <tr><td>End Date</td><td>${fmtDate(booking.hireEndDate)}</td></tr>
      ${booking.expectedReturnDate ? `<tr><td>Expected Return</td><td>${fmtDate(booking.expectedReturnDate)}</td></tr>` : ""}
      <tr><td>Rate</td><td>${fmtCurrency(booking.rateAmount)} ${rateLabels[booking.rateType] || booking.rateType}</td></tr>
      <tr><td>Charge Rule</td><td>${chargeLabels[booking.chargeRule] || booking.chargeRule}</td></tr>
    </table>
  </div>

  ${booking.deliveryRequired || booking.pickupRequired ? `
  <div class="section">
    <div class="section-title">Logistics</div>
    <table>
      ${booking.deliveryRequired ? `
        <tr><td>Delivery Required</td><td>Yes</td></tr>
        ${booking.deliveryAddress ? `<tr><td>Delivery Address</td><td>${booking.deliveryAddress}</td></tr>` : ""}
        ${booking.deliveryCost ? `<tr><td>Delivery Cost</td><td>${fmtCurrency(booking.deliveryCost)}</td></tr>` : ""}
      ` : ""}
      ${booking.pickupRequired ? `
        <tr><td>Pickup Required</td><td>Yes</td></tr>
        ${booking.pickupCost ? `<tr><td>Pickup Cost</td><td>${fmtCurrency(booking.pickupCost)}</td></tr>` : ""}
      ` : ""}
    </table>
  </div>
  ` : ""}

  ${booking.notes ? `
  <div class="section">
    <div class="section-title">Notes</div>
    <p style="font-size: 13px; white-space: pre-wrap;">${booking.notes}</p>
  </div>
  ` : ""}

  <div class="footer">
    Generated by ${companyName} on ${format(new Date(), "dd/MM/yyyy 'at' HH:mm")}
  </div>
</body>
</html>`;
}

router.post("/api/hire-bookings/:id/send-email", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = String(req.params.id);

    const emailTo = req.body.to as string;
    const emailCc = req.body.cc as string | undefined;
    const emailSubject = req.body.subject as string | undefined;
    const emailMessage = req.body.message as string | undefined;

    if (!emailTo) return res.status(400).json({ error: "Recipient email is required" });

    const result = await db
      .select({
        booking: hireBookings,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
          phone: suppliers.phone,
          keyContact: suppliers.keyContact,
          addressLine1: suppliers.addressLine1,
          addressLine2: suppliers.addressLine2,
          city: suppliers.city,
          state: suppliers.state,
          postcode: suppliers.postcode,
        },
        job: {
          id: jobs.id,
          name: jobs.name,
          jobNumber: jobs.jobNumber,
        },
        requestedBy: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
        },
      })
      .from(hireBookings)
      .leftJoin(suppliers, eq(hireBookings.supplierId, suppliers.id))
      .leftJoin(jobs, eq(hireBookings.jobId, jobs.id))
      .leftJoin(employees, eq(hireBookings.requestedByUserId, employees.id))
      .where(and(eq(hireBookings.id, id), eq(hireBookings.companyId, companyId)))
      .limit(1);

    if (result.length === 0) return res.status(404).json({ error: "Hire booking not found" });

    const row = result[0];
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    const companyName = company?.name || "LTE Performance Management";

    const subject = emailSubject || `Equipment Hire Booking ${row.booking.bookingNumber}`;
    const htmlContent = buildHireBookingHtml(row.booking, row.supplier, row.job, row.requestedBy, companyName);

    const introMessage = emailMessage
      ? `<div style="font-family: Arial, sans-serif; padding: 16px; font-size: 14px; color: #333; border-bottom: 1px solid #ddd; margin-bottom: 16px;">${emailMessage.replace(/\n/g, "<br>")}</div>`
      : "";

    const fullHtml = introMessage + htmlContent;

    const emailResult = await emailService.sendEmailWithAttachment({
      to: emailTo,
      cc: emailCc,
      subject,
      body: fullHtml,
    });

    if (!emailResult.success) {
      return res.status(500).json({ error: emailResult.error || "Failed to send email" });
    }

    res.json({ success: true, messageId: emailResult.messageId });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error sending hire booking email");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send email" });
  }
});

export { router as hireRouter };
