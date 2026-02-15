import { storage } from "../storage";
import logger from "./logger";

export interface BrandedEmailOptions {
  title: string;
  subtitle?: string;
  recipientName?: string;
  body: string;
  footerNote?: string;
  attachmentSummary?: string;
  companyId?: string;
}

interface CompanyBrandingData {
  companyName: string;
  logoBase64: string | null;
  emailTemplateHtml: string | null;
}

const brandingCache = new Map<string, { data: CompanyBrandingData; expiry: number }>();

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{{TITLE}}</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .header-cell { background-color: #1a1a1a !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 24px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td class="header-cell" bgcolor="#1a1a1a" style="background-color: #1a1a1a; padding: 20px 28px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation">
                <tr>
                  <td style="padding-bottom: 6px;">{{LOGO}}</td>
                </tr>
                <tr>
                  <td>
                    <h2 style="margin: 0; font-size: 17px; font-weight: 600; color: #ffffff; mso-line-height-rule: exactly;">{{TITLE}}</h2>
                    {{SUBTITLE}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 28px; color: #334155; font-size: 15px; line-height: 1.65;">
              {{GREETING}}
              {{BODY}}
              {{ATTACHMENT_SUMMARY}}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td bgcolor="#f8fafc" style="padding: 16px 28px 20px; border-top: 1px solid #e2e8f0; background-color: #f8fafc;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                This is an automated notification from {{COMPANY_NAME}}. Please do not reply directly to this email.
              </p>
              {{FOOTER_NOTE}}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

async function getCompanyBranding(companyId?: string): Promise<CompanyBrandingData> {
  if (!companyId) {
    return { companyName: "BuildPlus Ai", logoBase64: null, emailTemplateHtml: null };
  }
  const cacheKey = companyId;
  const now = Date.now();
  const cached = brandingCache.get(cacheKey);
  if (cached && now < cached.expiry) {
    return cached.data;
  }
  try {
    const settings = await storage.getGlobalSettings(companyId);
    const data: CompanyBrandingData = {
      companyName: settings?.companyName || "BuildPlus Ai",
      logoBase64: settings?.logoBase64 || null,
      emailTemplateHtml: (settings as any)?.emailTemplateHtml || null,
    };
    brandingCache.set(cacheKey, { data, expiry: now + 5 * 60 * 1000 });
    return data;
  } catch (err) {
    logger.warn({ err }, "Failed to load company branding for email template");
    return { companyName: "BuildPlus Ai", logoBase64: null, emailTemplateHtml: null };
  }
}

export function clearBrandingCache(companyId?: string) {
  if (companyId) {
    brandingCache.delete(companyId);
  } else {
    brandingCache.clear();
  }
}

export async function buildBrandedEmail(options: BrandedEmailOptions): Promise<string> {
  const branding = await getCompanyBranding(options.companyId);
  const { companyName, logoBase64 } = branding;

  const template = branding.emailTemplateHtml || DEFAULT_TEMPLATE;

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="${companyName}" style="max-height: 36px; max-width: 180px; vertical-align: middle;" />`
    : `<span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">${companyName}</span>`;

  const subtitleHtml = options.subtitle
    ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">${options.subtitle}</p>`
    : "";

  const greetingHtml = options.recipientName
    ? `<p style="margin: 0 0 16px 0;">Dear ${options.recipientName},</p>`
    : "";

  const attachmentSummaryHtml = options.attachmentSummary
    ? `<div style="margin-top: 20px; padding: 14px 16px; background-color: #f0f4f8; border-radius: 6px; border-left: 3px solid #2563eb;">
        ${options.attachmentSummary}
      </div>`
    : "";

  const footerNoteHtml = options.footerNote
    ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">${options.footerNote}</p>`
    : "";

  const result = template
    .replace(/\{\{TITLE\}\}/g, options.title)
    .replace(/\{\{SUBTITLE\}\}/g, subtitleHtml)
    .replace(/\{\{LOGO\}\}/g, logoHtml)
    .replace(/\{\{GREETING\}\}/g, greetingHtml)
    .replace(/\{\{BODY\}\}/g, options.body)
    .replace(/\{\{ATTACHMENT_SUMMARY\}\}/g, attachmentSummaryHtml)
    .replace(/\{\{COMPANY_NAME\}\}/g, companyName)
    .replace(/\{\{FOOTER_NOTE\}\}/g, footerNoteHtml);

  return result;
}

export function getDefaultTemplate(): string {
  return DEFAULT_TEMPLATE;
}
