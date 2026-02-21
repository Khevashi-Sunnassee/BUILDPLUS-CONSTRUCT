import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    companyId?: string;
    name?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      companyId?: string;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // Attach companyId to request for easy access
  req.companyId = req.session.companyId;
  next();
};

export const requireRole = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    // Attach companyId to request for easy access
    req.companyId = req.session.companyId;
    next();
  };
};

export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || !user.isSuperAdmin) {
    return res.status(403).json({ error: "Forbidden: Super Admin access required" });
  }
  req.companyId = req.session.companyId;
  next();
};

export const requireRoleOrSuperAdmin = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (user.isSuperAdmin) {
      const overrideCompanyId = req.query.companyId as string | undefined;
      req.companyId = overrideCompanyId || req.session.companyId;
      return next();
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.companyId = req.session.companyId;
    next();
  };
};

export const requireCompanyContext = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.companyId) {
    return res.status(403).json({ error: "Company context required" });
  }
  req.companyId = req.session.companyId;
  next();
};
