import { z } from "zod";
import multer from "multer";

export const supplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  keyContact: z.string().max(255).optional().nullable().or(z.literal("")),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable().or(z.literal("")),
  abn: z.string().max(50).optional().nullable().or(z.literal("")),
  acn: z.string().max(50).optional().nullable().or(z.literal("")),
  addressLine1: z.string().max(255).optional().nullable().or(z.literal("")),
  addressLine2: z.string().max(255).optional().nullable().or(z.literal("")),
  city: z.string().max(100).optional().nullable().or(z.literal("")),
  state: z.string().max(50).optional().nullable().or(z.literal("")),
  postcode: z.string().max(20).optional().nullable().or(z.literal("")),
  country: z.string().max(100).optional().nullable().or(z.literal("")),
  paymentTerms: z.string().max(255).optional().nullable().or(z.literal("")),
  notes: z.string().max(5000).optional().nullable().or(z.literal("")),
  defaultCostCodeId: z.string().max(36).optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional(),
  isEquipmentHire: z.boolean().optional(),
  availableForTender: z.boolean().optional(),
});

export const itemCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(50).optional(),
  description: z.string().max(1000).optional().nullable(),
  defaultCostCodeId: z.string().max(36).optional().nullable(),
  categoryType: z.enum(["supply", "trade"]).optional().default("supply"),
  isActive: z.boolean().optional(),
});

export const itemSchema = z.object({
  code: z.string().min(1, "Code is required").max(100),
  description: z.string().min(1, "Description is required").max(1000),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  constructionStageId: z.string().optional().nullable(),
  unitOfMeasure: z.string().max(50).optional(),
  unitPrice: z.string().optional(),
  preferredSupplierId: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  itemType: z.enum(["local", "imported"]).optional(),
  isActive: z.boolean().optional(),
});

export const sendPoEmailWithPdfSchema = z.object({
  to: z.string().email("Valid email address is required"),
  cc: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  sendCopy: z.boolean().default(false),
});

export const sendPoEmailSchema = z.object({
  to: z.string().email("Valid email address is required"),
  cc: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
  attachPdf: z.boolean().default(true),
  sendCopy: z.boolean().default(false),
  pdfBase64: z.string().optional(),
});

export const SUPPLIER_TEMPLATE_COLUMNS = [
  { header: "Name", key: "name", width: 30 },
  { header: "Key Contact", key: "keyContact", width: 25 },
  { header: "Email", key: "email", width: 30 },
  { header: "Phone", key: "phone", width: 20 },
  { header: "ABN", key: "abn", width: 20 },
  { header: "ACN", key: "acn", width: 20 },
  { header: "Address Line 1", key: "addressLine1", width: 30 },
  { header: "Address Line 2", key: "addressLine2", width: 30 },
  { header: "City", key: "city", width: 20 },
  { header: "State", key: "state", width: 15 },
  { header: "Postcode", key: "postcode", width: 15 },
  { header: "Country", key: "country", width: 20 },
  { header: "Payment Terms", key: "paymentTerms", width: 25 },
  { header: "Notes", key: "notes", width: 40 },
];

export const SUPPLIER_HEADER_MAP: Record<string, string> = {
  "name": "name",
  "supplier name": "name",
  "company": "name",
  "key contact": "keyContact",
  "contact": "keyContact",
  "contact name": "keyContact",
  "email": "email",
  "email address": "email",
  "phone": "phone",
  "phone number": "phone",
  "phone no. 1": "phone",
  "phone no. 2": "phone2",
  "abn": "abn",
  "a.b.n.": "abn",
  "acn": "acn",
  "a.c.n.": "acn",
  "address line 1": "addressLine1",
  "address street line 1": "addressLine1",
  "address": "addressLine1",
  "street": "addressLine1",
  "address line 2": "addressLine2",
  "address street line 2": "addressLine2",
  "address street line 3": "addressLine2Extra",
  "city": "city",
  "suburb": "city",
  "state": "state",
  "postcode": "postcode",
  "zip": "postcode",
  "country": "country",
  "payment terms": "paymentTerms",
  "terms": "paymentTerms",
  "notes": "notes",
  "status": "status",
  "type (supplier)": "type",
  "card id": "cardId",
};

export const ALLOWED_IMPORT_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMPORT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Only Excel and CSV files are accepted.`));
    }
  },
});
