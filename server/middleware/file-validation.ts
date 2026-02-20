import { Request, Response, NextFunction } from "express";
import { validateUploadedFile } from "../lib/security";
import logger from "../lib/logger";

export function validateUploads(options?: { maxSizeBytes?: number; allowedExtensions?: Set<string> }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const files: Express.Multer.File[] = [];

    if (req.file) {
      files.push(req.file);
    }
    if (req.files) {
      if (Array.isArray(req.files)) {
        files.push(...req.files);
      } else {
        for (const fieldFiles of Object.values(req.files)) {
          files.push(...fieldFiles);
        }
      }
    }

    if (files.length === 0) {
      return next();
    }

    for (const file of files) {
      const result = validateUploadedFile(file.originalname, file.buffer, options);
      if (!result.valid) {
        logger.warn({
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          error: result.error,
        }, "File upload rejected by security validation");
        return res.status(400).json({ error: result.error });
      }
      file.originalname = result.sanitizedName;
    }

    next();
  };
}
