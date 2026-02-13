import { storage } from "../storage";
import logger from "./logger";

interface BrandedEmailOptions {
  title?: string;
  subtitle?: string;
  body: string;
  footerNote?: string;
  attachmentSummary?: string;
  companyId?: string;
}

let cachedSettings: { companyName: string; logoBase64: string | null } | null = null;
let cacheExpiry = 0;

async function getCompanyBranding(companyId?: string): Promise<{ companyName: string; logoBase64: string | null }> {
  const now = Date.now();
  if (cachedSettings && now < cacheExpiry && !companyId) {
    return cachedSettings;
  }
  try {
    const settings = await storage.getGlobalSettings(companyId);
    cachedSettings = {
      companyName: settings?.companyName || "BuildPlus Ai",
      logoBase64: settings?.logoBase64 || null,
    };
    cacheExpiry = now + 5 * 60 * 1000;
    return cachedSettings;
  } catch (err) {
    logger.warn({ err }, "Failed to load company branding for email template");
    return { companyName: "BuildPlus Ai", logoBase64: null };
  }
}

export async function buildBrandedEmail(options: BrandedEmailOptions): Promise<string> {
  const { companyName, logoBase64 } = await getCompanyBranding(options.companyId);

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="${companyName}" style="max-height: 36px; max-width: 180px; vertical-align: middle;" />`
    : `<span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">${companyName}</span>`;

  const subtitleHtml = options.subtitle
    ? `<p style="margin: 0 0 0 0; font-size: 13px; color: #cbd5e1;">${options.subtitle}</p>`
    : "";

  const titleHtml = options.title
    ? `<h2 style="margin: 0; font-size: 17px; font-weight: 600; color: #ffffff;">${options.title}</h2>`
    : "";

  const headerContent = options.title
    ? `<td style="padding: 0;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding-bottom: 6px;">${logoHtml}</td>
            </tr>
            <tr>
              <td>${titleHtml}${subtitleHtml}</td>
            </tr>
          </table>
        </td>`
    : `<td style="padding: 0;">${logoHtml}</td>`;

  const attachmentSummaryHtml = options.attachmentSummary
    ? `<div style="margin-top: 20px; padding: 14px 16px; background-color: #f0f4f8; border-radius: 6px; border-left: 3px solid #2563eb;">
        ${options.attachmentSummary}
      </div>`
    : "";

  const footerNoteHtml = options.footerNote
    ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">${options.footerNote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title || companyName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 20px 28px;">
              ${headerContent}
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 28px; color: #334155; font-size: 15px; line-height: 1.65;">
              ${options.body}
              ${attachmentSummaryHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 28px 20px; border-top: 1px solid #e2e8f0; background-color: #f8fafc;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                Sent from <strong>${companyName}</strong> Management System
              </p>
              ${footerNoteHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
