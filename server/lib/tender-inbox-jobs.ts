import logger from "./logger";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  tenderInboundEmails, tenderEmailDocuments, tenderEmailExtractedFields,
  tenderEmailActivity, suppliers
} from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function logTenderActivity(inboundEmailId: string, activityType: string, message: string, actorUserId?: string, metaJson?: any) {
  await db.insert(tenderEmailActivity).values({
    inboundEmailId,
    activityType,
    message,
    actorUserId: actorUserId || null,
    metaJson: metaJson || null,
  });
}

export async function extractTenderEmailInline(
  inboundEmailId: string,
  companyId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<void> {
  try {
    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSING" })
      .where(eq(tenderInboundEmails.id, inboundEmailId));

    await logTenderActivity(inboundEmailId, "extraction_started", "AI extraction started");

    const base64Content = fileBuffer.toString("base64");
    const isPdf = mimeType === "application/pdf";

    const systemPrompt = `You are an AI assistant that extracts structured information from tender/quote submission documents received via email in a construction/manufacturing context.

Extract the following fields from the document. Return a JSON object with these keys:
- supplier_name: The company/supplier name submitting the tender or quote
- supplier_abn: Australian Business Number if found
- supplier_email: Email address of the supplier
- supplier_phone: Phone number
- supplier_contact_name: Contact person name
- tender_reference: Any tender/quote reference number
- project_name: The project or job name referenced
- total_amount: Total quoted/tendered amount (numeric string)
- currency: Currency code (default AUD)
- gst_included: Whether GST is included (true/false)
- gst_amount: GST amount if separately stated
- scope_summary: Brief summary of the scope of works being quoted
- validity_period: How long the quote is valid
- delivery_timeline: Proposed delivery or completion timeline
- payment_terms: Payment terms stated
- exclusions: Any noted exclusions
- inclusions: Any noted inclusions
- notes: Any other relevant notes

Only include fields where you can find or reasonably infer the value. Return valid JSON only.`;

    let content: any[];
    if (isPdf) {
      content = [
        { type: "file" as const, file: { filename: "tender.pdf", file_data: `data:application/pdf;base64,${base64Content}` } },
        { type: "text" as const, text: "Extract tender/quote information from this PDF document." },
      ];
    } else {
      content = [
        { type: "image_url" as const, image_url: { url: `data:${mimeType};base64,${base64Content}` } },
        { type: "text" as const, text: "Extract tender/quote information from this document image." },
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content || "";

    let extractedData: Record<string, any> = {};
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      logger.warn({ err: parseErr, inboundEmailId }, "[Tender Extract] Failed to parse AI response");
      extractedData = { raw_response: responseText };
    }

    const fields: { inboundEmailId: string; fieldKey: string; fieldValue: string | null; confidence: string; source: string }[] = [];
    for (const [key, value] of Object.entries(extractedData)) {
      if (value !== null && value !== undefined && value !== "") {
        fields.push({
          inboundEmailId,
          fieldKey: key,
          fieldValue: typeof value === "object" ? JSON.stringify(value) : String(value),
          confidence: "0.8500",
          source: "ai_extraction",
        });
      }
    }

    if (fields.length > 0) {
      await db.delete(tenderEmailExtractedFields)
        .where(eq(tenderEmailExtractedFields.inboundEmailId, inboundEmailId));

      for (const field of fields) {
        await db.insert(tenderEmailExtractedFields).values(field);
      }
    }

    if (extractedData.supplier_name) {
      const supplierName = extractedData.supplier_name;
      const matchedSuppliers = await db.select().from(suppliers)
        .where(and(
          eq(suppliers.companyId, companyId),
          eq(suppliers.isActive, true),
        ))
        .limit(1000);

      const normalizedName = supplierName.toLowerCase().trim();
      const match = matchedSuppliers.find(s => {
        const sName = s.name.toLowerCase().trim();
        return sName === normalizedName ||
          sName.includes(normalizedName) ||
          normalizedName.includes(sName);
      });

      if (match) {
        await db.update(tenderInboundEmails)
          .set({ supplierId: match.id })
          .where(eq(tenderInboundEmails.id, inboundEmailId));

        logger.info({ inboundEmailId, supplierId: match.id, supplierName: match.name }, "[Tender Extract] Auto-matched supplier");
      }
    }

    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSED", processedAt: new Date() })
      .where(eq(tenderInboundEmails.id, inboundEmailId));

    await logTenderActivity(inboundEmailId, "extraction_completed", `AI extraction completed: ${fields.length} fields extracted`, undefined, {
      fieldsExtracted: fields.length,
      supplierFound: !!extractedData.supplier_name,
    });

    logger.info({ inboundEmailId, fieldsExtracted: fields.length }, "[Tender Extract] Extraction complete");
  } catch (error: any) {
    logger.error({ err: error, inboundEmailId }, "[Tender Extract] Extraction error");

    await db.update(tenderInboundEmails)
      .set({
        status: "FAILED",
        processingError: error.message || "Extraction failed",
      })
      .where(eq(tenderInboundEmails.id, inboundEmailId));

    await logTenderActivity(inboundEmailId, "extraction_failed", `Extraction failed: ${error.message}`);
  }
}

export async function extractTenderEmailFromText(
  inboundEmailId: string,
  companyId: string,
  emailBodyText: string
): Promise<void> {
  try {
    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSING" })
      .where(eq(tenderInboundEmails.id, inboundEmailId));

    await logTenderActivity(inboundEmailId, "extraction_started", "AI extraction started from email body text");

    const systemPrompt = `You are an AI assistant that extracts structured information from tender/quote submission emails in a construction/manufacturing context.

Extract the following fields from the email text. Return a JSON object with these keys:
- supplier_name: The company/supplier name submitting the tender or quote
- supplier_abn: Australian Business Number if found
- supplier_email: Email address of the supplier
- supplier_phone: Phone number
- supplier_contact_name: Contact person name
- tender_reference: Any tender/quote reference number
- project_name: The project or job name referenced
- total_amount: Total quoted/tendered amount (numeric string)
- currency: Currency code (default AUD)
- gst_included: Whether GST is included (true/false)
- gst_amount: GST amount if separately stated
- scope_summary: Brief summary of the scope of works being quoted
- validity_period: How long the quote is valid
- delivery_timeline: Proposed delivery or completion timeline
- payment_terms: Payment terms stated
- exclusions: Any noted exclusions
- inclusions: Any noted inclusions
- notes: Any other relevant notes

Only include fields where you can find or reasonably infer the value. Return valid JSON only.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract tender/quote information from this email:\n\n${emailBodyText.substring(0, 15000)}` },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content || "";

    let extractedData: Record<string, any> = {};
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      logger.warn({ err: parseErr, inboundEmailId }, "[Tender Extract] Failed to parse AI response from text");
      extractedData = { raw_response: responseText };
    }

    const fields: { inboundEmailId: string; fieldKey: string; fieldValue: string | null; confidence: string; source: string }[] = [];
    for (const [key, value] of Object.entries(extractedData)) {
      if (value !== null && value !== undefined && value !== "") {
        fields.push({
          inboundEmailId,
          fieldKey: key,
          fieldValue: typeof value === "object" ? JSON.stringify(value) : String(value),
          confidence: "0.7000",
          source: "email_body_extraction",
        });
      }
    }

    if (fields.length > 0) {
      await db.delete(tenderEmailExtractedFields)
        .where(eq(tenderEmailExtractedFields.inboundEmailId, inboundEmailId));

      for (const field of fields) {
        await db.insert(tenderEmailExtractedFields).values(field);
      }
    }

    if (extractedData.supplier_name) {
      const supplierName = extractedData.supplier_name;
      const matchedSuppliers = await db.select().from(suppliers)
        .where(and(
          eq(suppliers.companyId, companyId),
          eq(suppliers.isActive, true),
        ))
        .limit(1000);

      const normalizedName = supplierName.toLowerCase().trim();
      const match = matchedSuppliers.find(s => {
        const sName = s.name.toLowerCase().trim();
        return sName === normalizedName ||
          sName.includes(normalizedName) ||
          normalizedName.includes(sName);
      });

      if (match) {
        await db.update(tenderInboundEmails)
          .set({ supplierId: match.id })
          .where(eq(tenderInboundEmails.id, inboundEmailId));

        logger.info({ inboundEmailId, supplierId: match.id, supplierName: match.name }, "[Tender Extract] Auto-matched supplier from email text");
      }
    }

    await db.update(tenderInboundEmails)
      .set({ status: "PROCESSED", processedAt: new Date() })
      .where(eq(tenderInboundEmails.id, inboundEmailId));

    await logTenderActivity(inboundEmailId, "extraction_completed", `AI extraction from email body completed: ${fields.length} fields extracted`, undefined, {
      fieldsExtracted: fields.length,
      supplierFound: !!extractedData.supplier_name,
      source: "email_body",
    });

    logger.info({ inboundEmailId, fieldsExtracted: fields.length }, "[Tender Extract] Email body extraction complete");
  } catch (error: any) {
    logger.error({ err: error, inboundEmailId }, "[Tender Extract] Email body extraction error");
    await logTenderActivity(inboundEmailId, "extraction_failed", `Email body extraction failed: ${error.message}`);
  }
}
