import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { requireUUID } from "../lib/api-utils";
import { db } from "../db";
import { hireBookings, employees, suppliers, jobs, assets, users, companies, factories, ASSET_CATEGORIES } from "@shared/schema";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import { emailService } from "../services/email.service";
import { buildBrandedEmail } from "../lib/email-template";
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
  hireLocation: z.string().nullable().optional(),
  hireLocationFactoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

async function getNextBookingNumber(companyId: string): Promise<string> {
  const { getNextSequenceNumber } = await import("../lib/sequence-generator");
  return getNextSequenceNumber("hire_booking", companyId, "HIRE-", 6);
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
    res.status(500).json({ error: "An internal error occurred" });
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
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/hire-bookings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

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
    res.status(500).json({ error: "An internal error occurred" });
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

    const startDate = new Date(data.hireStartDate);
    const endDate = new Date(data.hireEndDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    if (endDate < startDate) {
      return res.status(400).json({ error: "End date must be on or after the start date" });
    }

    if (data.hireSource === "external" && !data.supplierId) {
      return res.status(400).json({ error: "Supplier is required for external hire" });
    }
    if (data.hireSource === "internal" && !data.assetId) {
      return res.status(400).json({ error: "Asset selection is required for internal hire" });
    }

    let resolvedLocation = data.hireLocation || null;
    let resolvedFactoryId = data.hireLocationFactoryId || null;

    if (resolvedFactoryId) {
      const [factory] = await db.select({ id: factories.id, name: factories.name })
        .from(factories)
        .where(and(eq(factories.id, resolvedFactoryId), eq(factories.companyId, companyId)))
        .limit(1);
      if (!factory) {
        return res.status(400).json({ error: "Selected factory not found" });
      }
      resolvedLocation = factory.name;
    } else {
      resolvedFactoryId = null;
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
      hireLocation: resolvedLocation,
      hireLocationFactoryId: resolvedFactoryId,
      notes: data.notes || null,
      status: "DRAFT",
    }).returning();

    res.status(201).json(booking);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating hire booking");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.patch("/api/hire-bookings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

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
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

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
    {
      const resolvedStart = data.hireStartDate ? new Date(data.hireStartDate) : existing[0].hireStartDate;
      const resolvedEnd = data.hireEndDate ? new Date(data.hireEndDate) : existing[0].hireEndDate;
      if (resolvedStart && resolvedEnd && new Date(resolvedEnd) < new Date(resolvedStart)) {
        return res.status(400).json({ error: "End date must be on or after the start date" });
      }
    }
    if (data.expectedReturnDate !== undefined) updateData.expectedReturnDate = data.expectedReturnDate ? new Date(data.expectedReturnDate) : null;
    if (data.rateType !== undefined) updateData.rateType = data.rateType;
    if (data.rateAmount !== undefined) updateData.rateAmount = data.rateAmount || null;
    if (data.chargeRule !== undefined) updateData.chargeRule = data.chargeRule;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.deliveryRequired !== undefined) updateData.deliveryRequired = data.deliveryRequired;
    if (data.deliveryAddress !== undefined) updateData.deliveryAddress = data.deliveryAddress;
    if (data.deliveryCost !== undefined) updateData.deliveryCost = data.deliveryCost || null;
    if (data.pickupRequired !== undefined) updateData.pickupRequired = data.pickupRequired;
    if (data.pickupCost !== undefined) updateData.pickupCost = data.pickupCost || null;
    if (data.supplierReference !== undefined) updateData.supplierReference = data.supplierReference;
    if (data.hireLocationFactoryId !== undefined) {
      if (data.hireLocationFactoryId) {
        const [factory] = await db.select({ id: factories.id, name: factories.name })
          .from(factories)
          .where(and(eq(factories.id, data.hireLocationFactoryId), eq(factories.companyId, companyId)))
          .limit(1);
        if (!factory) {
          return res.status(400).json({ error: "Selected factory not found" });
        }
        updateData.hireLocationFactoryId = factory.id;
        updateData.hireLocation = factory.name;
      } else {
        updateData.hireLocationFactoryId = null;
        if (data.hireLocation !== undefined) {
          updateData.hireLocation = data.hireLocation || null;
        }
      }
    } else if (data.hireLocation !== undefined) {
      updateData.hireLocation = data.hireLocation || null;
      updateData.hireLocationFactoryId = null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    const [updated] = await db
      .update(hireBookings)
      .set(updateData)
      .where(and(eq(hireBookings.id, id), eq(hireBookings.companyId, companyId)))
      .returning();

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating hire booking");
    res.status(500).json({ error: "An internal error occurred" });
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
  extraUpdates?: Record<string, unknown>
) {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

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

    const updateData: Record<string, unknown> = {
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
    res.status(500).json({ error: "An internal error occurred" });
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

const rejectBookingSchema = z.object({
  reason: z.string().optional(),
  comments: z.string().optional(),
});

router.post("/api/hire-bookings/:id/reject", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const parsed = rejectBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    await transitionStatus(req, res, "CANCELLED", {
      notes: parsed.data.reason || parsed.data.comments || undefined,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ error: "An internal error occurred" });
  }
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

const returnBookingSchema = z.object({
  returnDate: z.string().optional(),
  returnNotes: z.string().optional(),
  condition: z.string().optional(),
});

router.post("/api/hire-bookings/:id/return", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = returnBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const extraUpdates: Record<string, unknown> = {};
    if (parsed.data.returnDate) extraUpdates.actualReturnDate = new Date(parsed.data.returnDate);
    if (parsed.data.returnNotes) extraUpdates.notes = parsed.data.returnNotes;
    await transitionStatus(req, res, "RETURNED", extraUpdates);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

const cancelBookingSchema = z.object({
  reason: z.string().optional(),
  comments: z.string().optional(),
});

router.post("/api/hire-bookings/:id/cancel", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = cancelBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    await transitionStatus(req, res, "CANCELLED", {
      notes: parsed.data.reason || parsed.data.comments || undefined,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/hire-bookings/:id/close", requireAuth, requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  await transitionStatus(req, res, "CLOSED");
});

router.delete("/api/hire-bookings/:id", requireAuth, requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

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
    res.status(500).json({ error: "An internal error occurred" });
  }
});

function buildHireBookingDetailsHtml(booking: Record<string, any>, supplier: Record<string, any> | null, job: Record<string, any> | null, requestedBy: Record<string, any> | null): string {
  const fmtDate = (d: string | Date | null | undefined) => d ? format(new Date(d as string | Date), "dd/MM/yyyy") : "-";
  const fmtCurrency = (v: string | number | null | undefined) => v ? `$${parseFloat(String(v)).toFixed(2)}` : "-";
  const rateLabels: Record<string, string> = { day: "Per Day", week: "Per Week", month: "Per Month", custom: "Custom" };
  const chargeLabels: Record<string, string> = { calendar_days: "Calendar Days", business_days: "Business Days", minimum_days: "Minimum Days" };

  const sectionStyle = "margin-bottom: 20px;";
  const sectionTitleStyle = "font-size: 14px; font-weight: bold; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-bottom: 12px;";
  const tdStyle = "padding: 6px 8px; vertical-align: top; font-size: 13px;";
  const tdLabelStyle = `${tdStyle} font-weight: 600; color: #555; width: 180px;`;

  return `
  <div style="${sectionStyle}">
    <div style="${sectionTitleStyle}">Booking Details</div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="${tdLabelStyle}">Booking Number</td><td style="${tdStyle}">${booking.bookingNumber}</td></tr>
      <tr><td style="${tdLabelStyle}">Status</td><td style="${tdStyle}">${String(booking.status || "").replace(/_/g, " ")}</td></tr>
      <tr><td style="${tdLabelStyle}">Equipment Source</td><td style="${tdStyle}">${booking.hireSource === "external" ? "External (Hire Company)" : "Internal"}</td></tr>
      <tr><td style="${tdLabelStyle}">Equipment Description</td><td style="${tdStyle}">${booking.equipmentDescription}</td></tr>
      <tr><td style="${tdLabelStyle}">Asset Category</td><td style="${tdStyle}">${ASSET_CATEGORIES[Number(booking.assetCategoryIndex)] || "Unknown"}</td></tr>
      <tr><td style="${tdLabelStyle}">Quantity</td><td style="${tdStyle}">${booking.quantity || 1}</td></tr>
    </table>
  </div>

  ${supplier && supplier.id ? `
  <div style="${sectionStyle}">
    <div style="${sectionTitleStyle}">Supplier / Hire Company</div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="${tdLabelStyle}">Company</td><td style="${tdStyle}">${supplier.name || "-"}</td></tr>
      <tr><td style="${tdLabelStyle}">Contact</td><td style="${tdStyle}">${supplier.keyContact || "-"}</td></tr>
      <tr><td style="${tdLabelStyle}">Email</td><td style="${tdStyle}">${supplier.email || "-"}</td></tr>
      <tr><td style="${tdLabelStyle}">Phone</td><td style="${tdStyle}">${supplier.phone || "-"}</td></tr>
      ${supplier.addressLine1 ? `<tr><td style="${tdLabelStyle}">Address</td><td style="${tdStyle}">${[supplier.addressLine1, supplier.addressLine2, supplier.city, supplier.state, supplier.postcode].filter(Boolean).join(", ")}</td></tr>` : ""}
      ${booking.supplierReference ? `<tr><td style="${tdLabelStyle}">Supplier Reference</td><td style="${tdStyle}">${booking.supplierReference}</td></tr>` : ""}
    </table>
  </div>
  ` : ""}

  <div style="${sectionStyle}">
    <div style="${sectionTitleStyle}">Job Details</div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="${tdLabelStyle}">Job</td><td style="${tdStyle}">${job ? `${job.jobNumber} - ${job.name}` : "-"}</td></tr>
      <tr><td style="${tdLabelStyle}">Requested By</td><td style="${tdStyle}">${requestedBy ? `${requestedBy.firstName} ${requestedBy.lastName}` : "-"}</td></tr>
      ${booking.costCode ? `<tr><td style="${tdLabelStyle}">Cost Code</td><td style="${tdStyle}">${booking.costCode}</td></tr>` : ""}
    </table>
  </div>

  <div style="${sectionStyle}">
    <div style="${sectionTitleStyle}">Hire Period & Rates</div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="${tdLabelStyle}">Start Date</td><td style="${tdStyle}">${fmtDate(booking.hireStartDate as string | null)}</td></tr>
      <tr><td style="${tdLabelStyle}">End Date</td><td style="${tdStyle}">${fmtDate(booking.hireEndDate as string | null)}</td></tr>
      ${booking.expectedReturnDate ? `<tr><td style="${tdLabelStyle}">Expected Return</td><td style="${tdStyle}">${fmtDate(booking.expectedReturnDate as string | null)}</td></tr>` : ""}
      <tr><td style="${tdLabelStyle}">Rate</td><td style="${tdStyle}">${fmtCurrency(booking.rateAmount as string | number | null)} ${rateLabels[String(booking.rateType)] || booking.rateType}</td></tr>
      <tr><td style="${tdLabelStyle}">Charge Rule</td><td style="${tdStyle}">${chargeLabels[String(booking.chargeRule)] || booking.chargeRule}</td></tr>
    </table>
  </div>

  ${booking.deliveryRequired || booking.pickupRequired ? `
  <div style="${sectionStyle}">
    <div style="${sectionTitleStyle}">Logistics</div>
    <table style="width: 100%; border-collapse: collapse;">
      ${booking.deliveryRequired ? `
        <tr><td style="${tdLabelStyle}">Delivery Required</td><td style="${tdStyle}">Yes</td></tr>
        ${booking.deliveryAddress ? `<tr><td style="${tdLabelStyle}">Delivery Address</td><td style="${tdStyle}">${booking.deliveryAddress}</td></tr>` : ""}
        ${booking.deliveryCost ? `<tr><td style="${tdLabelStyle}">Delivery Cost</td><td style="${tdStyle}">${fmtCurrency(booking.deliveryCost as string | number | null)}</td></tr>` : ""}
      ` : ""}
      ${booking.pickupRequired ? `
        <tr><td style="${tdLabelStyle}">Pickup Required</td><td style="${tdStyle}">Yes</td></tr>
        ${booking.pickupCost ? `<tr><td style="${tdLabelStyle}">Pickup Cost</td><td style="${tdStyle}">${fmtCurrency(booking.pickupCost as string | number | null)}</td></tr>` : ""}
      ` : ""}
    </table>
  </div>
  ` : ""}

  ${booking.notes ? `
  <div style="${sectionStyle}">
    <div style="${sectionTitleStyle}">Notes</div>
    <p style="font-size: 13px; white-space: pre-wrap;">${booking.notes}</p>
  </div>
  ` : ""}`;
}

router.post("/api/hire-bookings/:id/send-email", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

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
    const companyName = company?.name || "BuildPlus Ai";

    const subject = emailSubject || `Equipment Hire Booking ${row.booking.bookingNumber}`;
    const hireDetailsHtml = buildHireBookingDetailsHtml(row.booking, row.supplier, row.job, row.requestedBy);

    const introHtml = emailMessage
      ? `<div style="margin-bottom: 16px;">${emailMessage.replace(/\n/g, "<br>")}</div>`
      : "";

    const fullHtml = await buildBrandedEmail({
      title: `Equipment Hire Booking - ${row.booking.bookingNumber}`,
      body: `${introHtml}${hireDetailsHtml}`,
      companyId,
    });

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
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export { router as hireRouter };
