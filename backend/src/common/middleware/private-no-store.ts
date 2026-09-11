import type { NextFunction, Request, Response } from "express";

export function privateNoStore(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Pragma", "no-cache");
  next();
}
