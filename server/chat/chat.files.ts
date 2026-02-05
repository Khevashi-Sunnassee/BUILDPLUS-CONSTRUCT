import multer from "multer";

const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff",
  // PDF
  "application/pdf",
  // Microsoft Office
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text files
  "text/plain", "text/csv", "text/html", "text/xml", "application/json",
  // Archives
  "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
  // CAD/Engineering (common in construction)
  "application/acad", "application/x-autocad", "image/vnd.dwg", "image/x-dwg",
  "application/dxf", "image/vnd.dxf",
  // IFC (Building Information Modeling)
  "application/x-step", "application/ifc",
  // Other common formats
  "application/rtf", "application/xml",
];

export const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 25 * 1024 * 1024, // 25MB max per file
    files: 10, // Max 10 files per request
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});
