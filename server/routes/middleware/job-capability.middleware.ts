import { Request, Response, NextFunction } from "express";
import { storage } from "../../storage";
import { jobHasCapability } from "@shared/job-phases";
import type { JobPhase, JobCapability } from "@shared/job-phases";

export function requireJobCapability(capability: JobCapability, jobIdExtractor?: (req: Request) => string | null) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let jobId: string | null = null;

      if (jobIdExtractor) {
        jobId = jobIdExtractor(req);
      } else {
        jobId = (req.params.jobId as string) || (req.body?.jobId as string) || (req.query?.jobId as string) || null;
      }

      if (!jobId) {
        return next();
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const phase = ((job as any).jobPhase || "CONTRACTED") as JobPhase;

      if (!jobHasCapability(phase, capability)) {
        return res.status(403).json({
          error: `This action is not available for jobs in the "${phase}" phase`,
          requiredCapability: capability,
          currentPhase: phase,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
