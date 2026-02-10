import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage";
import type { FunctionKey } from "@shared/schema";

export type PermissionLevel = "VIEW" | "VIEW_AND_UPDATE";

declare global {
  namespace Express {
    interface Request {
      permissionLevel?: string;
    }
  }
}

export const requirePermission = (functionKey: string, minimumLevel: PermissionLevel = "VIEW") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    if (user.role === "ADMIN") {
      req.permissionLevel = "VIEW_AND_UPDATE";
      return next();
    }
    
    const permission = await storage.getUserPermission(req.session.userId, functionKey as FunctionKey);
    
    if (!permission || permission.permissionLevel === "HIDDEN") {
      return res.status(403).json({ error: "Access denied to this function" });
    }
    
    const level = permission.permissionLevel;
    req.permissionLevel = level;

    if (minimumLevel === "VIEW_AND_UPDATE") {
      if (level === "VIEW" || level === "VIEW_OWN") {
        return res.status(403).json({ error: "You only have view access to this function" });
      }
    }

    if (minimumLevel === "VIEW") {
      // VIEW_OWN and VIEW_AND_UPDATE_OWN both grant at least view access (filtered by ownership at route level)
    }
    
    next();
  };
};
