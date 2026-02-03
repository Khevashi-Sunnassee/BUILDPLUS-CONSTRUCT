import multer from "multer";
import path from "path";
import fs from "fs";
import { createId } from "@paralleldrive/cuid2";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "chat");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const chatUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^\w.\-() ]+/g, "_");
      cb(null, `${createId()}__${safeName}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});
