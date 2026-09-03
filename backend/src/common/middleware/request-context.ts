import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const requestIdPattern = /^[A-Za-z0-9_-]{8,100}$/;

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const suppliedRequestId = req.get("X-Request-ID");
  const requestId =
    suppliedRequestId !== undefined && requestIdPattern.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

  res.locals.requestId = requestId;
  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}
