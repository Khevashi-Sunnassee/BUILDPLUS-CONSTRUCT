import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage";
import type { FunctionKey } from "@shared/schema";

export type PermissionLevel = "VIEW" | "VIEW_AND_UPDATE";

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
      return next();
    }
    
    const permission = await storage.getUserPermission(req.session.userId, functionKey as FunctionKey);
    
    if (!permission || permission.permissionLevel === "HIDDEN") {
      return res.status(403).json({ error: "Access denied to this function" });
    }
    
    if (minimumLevel === "VIEW_AND_UPDATE" && permission.permissionLevel === "VIEW") {
      return res.status(403).json({ error: "You only have view access to this function" });
    }
    
    next();
  };
};
