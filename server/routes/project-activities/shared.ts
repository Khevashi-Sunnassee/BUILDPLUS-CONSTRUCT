import multer from "multer";

export const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv", "application/json",
  "application/zip",
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

export function addWorkingDaysHelper(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added++;
    }
  }
  return result;
}

export function nextWorkingDayHelper(from: Date): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + 1);
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

export function ensureWorkingDayHelper(d: Date): Date {
  const result = new Date(d);
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

export function subtractWorkingDaysHelper(from: Date, days: number): Date {
  const result = new Date(from);
  let subtracted = 0;
  while (subtracted < days) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      subtracted++;
    }
  }
  return result;
}

export function resolveActivityStart(
  predDates: { start: Date; end: Date },
  rel: string,
  estimatedDays: number
): Date {
  let activityStart: Date;
  switch (rel) {
    case "FS":
      activityStart = nextWorkingDayHelper(predDates.end);
      break;
    case "SS":
      activityStart = new Date(predDates.start);
      break;
    case "FF":
      activityStart = subtractWorkingDaysHelper(new Date(predDates.end), estimatedDays - 1);
      break;
    case "SF":
      activityStart = subtractWorkingDaysHelper(new Date(predDates.start), estimatedDays - 1);
      break;
    default:
      activityStart = nextWorkingDayHelper(predDates.end);
  }
  return ensureWorkingDayHelper(activityStart);
}
