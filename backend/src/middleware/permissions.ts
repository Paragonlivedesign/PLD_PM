import type { Request, Response, NextFunction } from "express";
import { singleError } from "../http/envelope.js";

/** Dev: header X-Permissions: * or comma list e.g. trucks:create,scheduling:create */
export function hasPermission(req: Request, perm: string): boolean {
  const raw = req.header("X-Permissions")?.trim();
  if (!raw || raw === "*") return true;
  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return set.has("*") || set.has(perm);
}

export function requirePermission(perm: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!hasPermission(req, perm)) {
      const { body, status } = singleError("forbidden", `Missing permission: ${perm}`, 403);
      res.status(status).json(body);
      return;
    }
    next();
  };
}
