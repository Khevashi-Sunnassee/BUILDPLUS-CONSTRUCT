export const AP_EXTRACTION_SYSTEM_PROMPT = `You are an accounts payable invoice extraction engine.

Your task is to extract ONLY high-level invoice summary information.

DO NOT extract line items.
DO NOT list product descriptions.
DO NOT list quantities.
DO NOT include payment instructions.

If line items are included in your response, the output is invalid.

Return a clean JSON object only.
If a field is not found, return null for that field.`;

const EXTRACTION_INSTRUCTIONS = `Extract the following invoice summary fields from this document.

Required fields:
- supplier_name: The supplier/vendor company name
- supplier_abn: The supplier ABN (Australian Business Number) if available
- invoice_number: The invoice number/reference
- invoice_date: The invoice date in ISO format YYYY-MM-DD
- due_date: The due/payment date in ISO format YYYY-MM-DD if available
- total_amount_inc_gst: The total amount payable including GST as a number (e.g. 1234.56)
- total_gst: The GST/tax amount as a number
- subtotal_ex_gst: The subtotal before tax as a number
- currency: The currency code (default "AUD" if not stated)
- description: A brief summary of what the invoice is for (one sentence max)
- purchase_order_number: The purchase order or PO number if present

Important:
- Only extract totals clearly labeled as TOTAL AMOUNT PAYABLE, TOTAL DUE, AMOUNT DUE, or equivalent.
- Ignore individual line item totals.
- Ignore discounts unless they change the final total.
- For monetary values, return numbers only (no currency symbols or commas).
- Do not return line item descriptions.

Return JSON only, matching this exact structure:
{
  "supplier_name": "",
  "supplier_abn": "",
  "invoice_number": "",
  "invoice_date": "",
  "due_date": null,
  "total_amount_inc_gst": 0.00,
  "total_gst": 0.00,
  "subtotal_ex_gst": 0.00,
  "currency": "AUD",
  "description": "",
  "purchase_order_number": null
}`;

export function buildExtractionUserPrompt(extractedText: string | null): string {
  if (extractedText && extractedText.length > 100) {
    const trimmedText = extractedText.length > 4000 
      ? extractedText.substring(0, 2000) + "\n\n...[middle content omitted]...\n\n" + extractedText.substring(extractedText.length - 2000)
      : extractedText;
    return `${EXTRACTION_INSTRUCTIONS}\n\nThe following text was extracted from the document. Use this as the primary source for data extraction. The attached image(s) are for visual verification only.\n\n--- EXTRACTED DOCUMENT TEXT ---\n${trimmedText}\n--- END DOCUMENT TEXT ---`;
  }
  return EXTRACTION_INSTRUCTIONS;
}

export const AP_EXTRACTION_USER_PROMPT = EXTRACTION_INSTRUCTIONS;

export interface ExtractedInvoiceData {
  supplier_name: string | null;
  supplier_abn: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_amount_inc_gst: number | null;
  total_gst: number | null;
  subtotal_ex_gst: number | null;
  currency: string | null;
  description: string | null;
  purchase_order_number: string | null;
}

export function sanitizeNumericValue(val: any): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/[^0-9.\-]/g, "");
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  return num.toFixed(2);
}

export function parseExtractedData(raw: any): ExtractedInvoiceData {
  return {
    supplier_name: raw.supplier_name || null,
    supplier_abn: raw.supplier_abn || null,
    invoice_number: raw.invoice_number || null,
    invoice_date: raw.invoice_date || null,
    due_date: raw.due_date || null,
    total_amount_inc_gst: raw.total_amount_inc_gst != null ? Number(raw.total_amount_inc_gst) : null,
    total_gst: raw.total_gst != null ? Number(raw.total_gst) : null,
    subtotal_ex_gst: raw.subtotal_ex_gst != null ? Number(raw.subtotal_ex_gst) : null,
    currency: raw.currency || "AUD",
    description: raw.description || null,
    purchase_order_number: raw.purchase_order_number || null,
  };
}

export function buildExtractedFieldRecords(invoiceId: string, data: ExtractedInvoiceData) {
  const fieldEntries: Array<{ fieldKey: string; fieldValue: string | null; confidence: number | null }> = [];

  const entries: [string, any][] = Object.entries(data);
  for (const [key, value] of entries) {
    if (value !== null && value !== undefined) {
      fieldEntries.push({
        fieldKey: key,
        fieldValue: String(value),
        confidence: null,
      });
    }
  }

  return fieldEntries;
}

export function buildInvoiceUpdateFromExtraction(data: ExtractedInvoiceData) {
  const updateData: Record<string, any> = {};

  if (data.invoice_number) updateData.invoiceNumber = data.invoice_number;
  if (data.invoice_date) {
    try { updateData.invoiceDate = new Date(data.invoice_date); } catch {}
  }
  if (data.due_date) {
    try { updateData.dueDate = new Date(data.due_date); } catch {}
  }

  const totalInc = sanitizeNumericValue(data.total_amount_inc_gst);
  const totalTax = sanitizeNumericValue(data.total_gst);
  const totalEx = sanitizeNumericValue(data.subtotal_ex_gst);

  if (totalInc) updateData.totalInc = totalInc;
  if (totalTax) updateData.totalTax = totalTax;
  if (totalEx) updateData.totalEx = totalEx;
  if (data.description) updateData.description = data.description;
  if (data.currency) updateData.currency = data.currency;

  let riskScore = 0;
  const riskReasons: string[] = [];

  if (!data.invoice_number) {
    riskScore += 25;
    riskReasons.push("Missing invoice number");
  }
  if (!totalInc) {
    riskScore += 25;
    riskReasons.push("Missing total amount");
  }
  if (!data.supplier_name) {
    riskScore += 15;
    riskReasons.push("Missing supplier name");
  }
  if (!data.invoice_date) {
    riskScore += 10;
    riskReasons.push("Missing invoice date");
  }

  if (totalInc && totalEx && totalTax) {
    const inc = parseFloat(totalInc);
    const ex = parseFloat(totalEx);
    const tax = parseFloat(totalTax);
    const diff = Math.abs(inc - (ex + tax));
    if (diff > 0.02) {
      riskScore += 20;
      riskReasons.push(`Total mismatch: $${inc} != $${ex} + $${tax} (diff: $${diff.toFixed(2)})`);
    }
  }

  updateData.riskScore = Math.min(riskScore, 100);
  updateData.riskReasons = riskReasons;

  return updateData;
}
