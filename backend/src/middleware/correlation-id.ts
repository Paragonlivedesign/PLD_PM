import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Accepts `X-Correlation-Id` or generates a UUID; echoes via response header.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-correlation-id")?.trim();
  const id = incoming && incoming.length > 0 ? incoming : randomUUID();
  req.correlationId = id;
  res.setHeader("X-Correlation-Id", id);
  next();
}
