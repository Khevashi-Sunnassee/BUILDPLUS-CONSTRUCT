import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { emailService } from "../services/email.service";
import logger from "../lib/logger";

const router = Router();

const createInvitationSchema = z.object({
  email: z.string().email("Valid email address is required"),
  companyId: z.string().optional(),
  role: z.enum(["USER", "MANAGER", "ADMIN"]).default("USER"),
  userType: z.enum(["EMPLOYEE", "EXTERNAL"]).default("EMPLOYEE"),
  departmentId: z.string().nullable().optional(),
});

router.post("/api/admin/invitations", requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = createInvitationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const { email, role, userType, departmentId } = parsed.data;
    const companyId = parsed.data.companyId || req.companyId!;

    const company = await storage.getCompany(companyId);
    if (!company) {
      return res.status(400).json({ error: "Company not found" });
    }

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser && existingUser.companyId === companyId) {
      return res.status(400).json({ error: "A user with this email already exists in this company" });
    }

    const { invitation, token } = await storage.createInvitation({
      companyId,
      email,
      role,
      userType,
      departmentId: departmentId || null,
      invitedBy: req.session.userId!,
    });

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const registrationLink = `${baseUrl}/register/${token}`;

    const inviter = await storage.getUser(req.session.userId!);
    const inviterName = inviter?.name || inviter?.email || "An administrator";

    if (emailService.isConfigured()) {
      try {
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a; margin-bottom: 16px;">You've been invited to BuildPlusAI</h2>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
              ${inviterName} has invited you to join <strong>${company.name}</strong> on the BuildPlusAI Performance Management System.
            </p>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
              Click the button below to set up your account. This link will expire in 7 days.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${registrationLink}" 
                 style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                Set Up Your Account
              </a>
            </div>
            <p style="color: #888; font-size: 13px; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <a href="${registrationLink}" style="color: #2563eb;">${registrationLink}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #888; font-size: 12px;">
              You're receiving this email because ${inviterName} invited you to join ${company.name}. 
              If you weren't expecting this invitation, you can safely ignore this email.
            </p>
          </div>
        `;

        await emailService.sendEmailWithAttachment({
          to: email,
          subject: `You're invited to join ${company.name} on BuildPlusAI`,
          body: htmlBody,
        });

        logger.info({ email, companyId, invitedBy: req.session.userId }, "Invitation email sent");
      } catch (emailErr) {
        logger.error({ err: emailErr, email }, "Failed to send invitation email, invitation still created");
      }
    } else {
      logger.warn("Email service not configured, invitation created without email notification");
    }

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        companyId: invitation.companyId,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
      registrationLink: !emailService.isConfigured() ? registrationLink : undefined,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating invitation");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create invitation" });
  }
});

router.get("/api/admin/invitations", requireRole("ADMIN"), async (req, res) => {
  try {
    await storage.expireOldInvitations();
    const invitations = await storage.getInvitationsByCompany(req.companyId!);
    res.json(invitations);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching invitations");
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

router.post("/api/admin/invitations/:id/cancel", requireRole("ADMIN"), async (req, res) => {
  try {
    const invitation = await storage.getInvitationById(req.params.id as string);
    if (!invitation || invitation.companyId !== req.companyId) {
      return res.status(404).json({ error: "Invitation not found" });
    }
    if (invitation.status !== "PENDING") {
      return res.status(400).json({ error: "Only pending invitations can be cancelled" });
    }
    await storage.cancelInvitation(req.params.id as string);
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error cancelling invitation");
    res.status(500).json({ error: "Failed to cancel invitation" });
  }
});

router.get("/api/invitations/:token", async (req, res) => {
  try {
    const invitation = await storage.getInvitationByToken(req.params.token as string);
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found or invalid", valid: false });
    }

    if (invitation.status === "ACCEPTED") {
      return res.status(400).json({ error: "This invitation has already been used", valid: false });
    }
    if (invitation.status === "CANCELLED") {
      return res.status(400).json({ error: "This invitation has been cancelled", valid: false });
    }
    if (invitation.status === "EXPIRED" || new Date() > invitation.expiresAt) {
      if (invitation.status !== "EXPIRED") {
        await storage.expireOldInvitations();
      }
      return res.status(400).json({ error: "This invitation has expired. Please contact your administrator for a new one.", valid: false });
    }

    const company = await storage.getCompany(invitation.companyId);

    res.json({
      valid: true,
      email: invitation.email,
      companyName: company?.name || "Unknown Company",
      role: invitation.role,
      userType: invitation.userType,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error validating invitation");
    res.status(500).json({ error: "Failed to validate invitation", valid: false });
  }
});

const registrationSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

router.post("/api/invitations/:token/register", async (req, res) => {
  try {
    const invitation = await storage.getInvitationByToken(req.params.token as string);
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found or invalid" });
    }
    if (invitation.status !== "PENDING") {
      return res.status(400).json({ error: "This invitation is no longer valid" });
    }
    if (new Date() > invitation.expiresAt) {
      await storage.expireOldInvitations();
      return res.status(400).json({ error: "This invitation has expired" });
    }

    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request", details: parsed.error.errors });
    }

    const { name, phone, address, password } = parsed.data;

    const existingUser = await storage.getUserByEmail(invitation.email);
    if (existingUser && existingUser.companyId === invitation.companyId) {
      await storage.markInvitationAccepted(invitation.id);
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    const user = await storage.createUser({
      companyId: invitation.companyId,
      email: invitation.email,
      name,
      phone,
      address,
      password,
      role: invitation.role,
      userType: invitation.userType,
      isActive: true,
    });

    await storage.markInvitationAccepted(invitation.id);

    logger.info({ userId: user.id, email: user.email, companyId: user.companyId }, "User registered via invitation");

    res.json({
      success: true,
      message: "Account created successfully. You can now sign in.",
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error processing registration");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create account" });
  }
});

export const invitationRouter = router;
