import { z } from "zod";
import path from "path";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REQUIREMENTS = [
  { test: (p: string) => p.length >= PASSWORD_MIN_LENGTH, message: `at least ${PASSWORD_MIN_LENGTH} characters` },
  { test: (p: string) => /[A-Z]/.test(p), message: "one uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), message: "one lowercase letter" },
  { test: (p: string) => /[0-9]/.test(p), message: "one number" },
  { test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(p), message: "one special character" },
];

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const req of PASSWORD_REQUIREMENTS) {
    if (!req.test(password)) {
      errors.push(req.message);
    }
  }
  return { valid: errors.length === 0, errors };
}

export const strongPasswordSchema = z.string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine((val) => /[A-Z]/.test(val), { message: "Password must contain at least one uppercase letter" })
  .refine((val) => /[a-z]/.test(val), { message: "Password must contain at least one lowercase letter" })
  .refine((val) => /[0-9]/.test(val), { message: "Password must contain at least one number" })
  .refine((val) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(val), { message: "Password must contain at least one special character (!@#$%^&* etc.)" });

export const optionalStrongPasswordSchema = z.string()
  .optional()
  .or(z.literal(""))
  .refine((val) => {
    if (!val || val === "") return true;
    return validatePasswordStrength(val).valid;
  }, {
    message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
  });

const DANGEROUS_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".vbs", ".vbe", ".js", ".jse",
  ".wsf", ".wsh", ".ps1", ".psc1", ".scr", ".pif", ".msi", ".msp",
  ".mst", ".cpl", ".hta", ".inf", ".ins", ".isp", ".lnk", ".reg",
  ".rgs", ".sct", ".shb", ".shs", ".ws", ".wsc", ".dll", ".sys",
  ".drv", ".ocx", ".sh", ".bash", ".csh", ".ksh", ".php", ".asp",
  ".aspx", ".jsp", ".py", ".rb", ".pl", ".cgi", ".htaccess",
]);

const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".rtf",
  ".ppt", ".pptx", ".odt", ".ods", ".odp",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg", ".tiff", ".tif", ".ico",
  ".mp4", ".avi", ".mov", ".wmv", ".mp3", ".wav",
  ".zip", ".rar", ".7z", ".gz", ".tar",
  ".dwg", ".dxf", ".rvt", ".ifc", ".skp",
  ".xml", ".json", ".yaml", ".yml",
  ".eml", ".msg",
]);

const MAGIC_BYTES: Array<{ ext: string[]; bytes: number[]; offset?: number }> = [
  { ext: [".pdf"], bytes: [0x25, 0x50, 0x44, 0x46] },
  { ext: [".png"], bytes: [0x89, 0x50, 0x4E, 0x47] },
  { ext: [".jpg", ".jpeg"], bytes: [0xFF, 0xD8, 0xFF] },
  { ext: [".gif"], bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: [".zip", ".xlsx", ".docx", ".pptx"], bytes: [0x50, 0x4B, 0x03, 0x04] },
  { ext: [".rar"], bytes: [0x52, 0x61, 0x72, 0x21] },
  { ext: [".7z"], bytes: [0x37, 0x7A, 0xBC, 0xAF] },
  { ext: [".gz", ".tar.gz"], bytes: [0x1F, 0x8B] },
  { ext: [".bmp"], bytes: [0x42, 0x4D] },
  { ext: [".webp"], bytes: [0x52, 0x49, 0x46, 0x46] },
  { ext: [".mp4"], bytes: [0x00, 0x00, 0x00], offset: 0 },
  { ext: [".exe", ".dll"], bytes: [0x4D, 0x5A] },
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedName: string;
}

export function validateUploadedFile(
  originalName: string,
  buffer: Buffer,
  options?: { maxSizeBytes?: number; allowedExtensions?: Set<string> }
): FileValidationResult {
  const sanitizedName = sanitizeFileName(originalName);
  const ext = path.extname(sanitizedName).toLowerCase();

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type "${ext}" is not allowed for security reasons`, sanitizedName };
  }

  const allowedExts = options?.allowedExtensions || ALLOWED_DOCUMENT_EXTENSIONS;
  if (!allowedExts.has(ext)) {
    return { valid: false, error: `File type "${ext}" is not supported`, sanitizedName };
  }

  if (options?.maxSizeBytes && buffer.length > options.maxSizeBytes) {
    const maxMB = (options.maxSizeBytes / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `File size exceeds ${maxMB}MB limit`, sanitizedName };
  }

  if (isExecutableMagicBytes(buffer)) {
    return { valid: false, error: "File content appears to be an executable and is not allowed", sanitizedName };
  }

  if (buffer.length > 0 && ext !== ".txt" && ext !== ".csv") {
    const magicMatch = MAGIC_BYTES.find(m => m.ext.includes(ext));
    if (magicMatch) {
      const offset = magicMatch.offset || 0;
      const matches = magicMatch.bytes.every((byte, i) => buffer[offset + i] === byte);
      if (!matches && buffer.length > 4) {
        return { valid: false, error: `File content does not match its "${ext}" extension`, sanitizedName };
      }
    }
  }

  return { valid: true, sanitizedName };
}

function isExecutableMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 2) return false;
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) return true;
  if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) return true;
  return false;
}

export function sanitizeFileName(name: string): string {
  let sanitized = path.basename(name);
  sanitized = sanitized.replace(/\.\./g, "");
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  sanitized = sanitized.replace(/^\.+/, "");
  if (sanitized.length === 0) {
    sanitized = "unnamed_file";
  }
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    sanitized = sanitized.substring(0, 255 - ext.length) + ext;
  }
  return sanitized;
}

const LOGIN_ATTEMPTS = new Map<string, { count: number; firstAttempt: number; lockedUntil: number | null }>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

export function checkAccountLockout(identifier: string): { locked: boolean; remainingMinutes?: number } {
  const record = LOGIN_ATTEMPTS.get(identifier);
  if (!record) return { locked: false };

  if (record.lockedUntil) {
    if (Date.now() < record.lockedUntil) {
      const remaining = Math.ceil((record.lockedUntil - Date.now()) / 60000);
      return { locked: true, remainingMinutes: remaining };
    }
    LOGIN_ATTEMPTS.delete(identifier);
    return { locked: false };
  }

  return { locked: false };
}

export function recordFailedLogin(identifier: string): { locked: boolean; attemptsRemaining: number } {
  const now = Date.now();
  let record = LOGIN_ATTEMPTS.get(identifier);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    record = { count: 1, firstAttempt: now, lockedUntil: null };
    LOGIN_ATTEMPTS.set(identifier, record);
    return { locked: false, attemptsRemaining: MAX_ATTEMPTS - 1 };
  }

  record.count++;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    LOGIN_ATTEMPTS.set(identifier, record);
    return { locked: true, attemptsRemaining: 0 };
  }

  LOGIN_ATTEMPTS.set(identifier, record);
  return { locked: false, attemptsRemaining: MAX_ATTEMPTS - record.count };
}

export function clearLoginAttempts(identifier: string): void {
  LOGIN_ATTEMPTS.delete(identifier);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of LOGIN_ATTEMPTS.entries()) {
    if (record.lockedUntil && now > record.lockedUntil) {
      LOGIN_ATTEMPTS.delete(key);
    } else if (!record.lockedUntil && now - record.firstAttempt > WINDOW_MS) {
      LOGIN_ATTEMPTS.delete(key);
    }
  }
}, 5 * 60 * 1000);
