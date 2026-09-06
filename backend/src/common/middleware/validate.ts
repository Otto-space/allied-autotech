import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

import { AppError } from "../errors/app-error.js";
import { errorCodes } from "../errors/error-codes.js";

export interface RequestSchemas {
  body?: ZodType;
  headers?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schemas: RequestSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const fields: Record<string, string[]> = {};
    const validated: Record<string, unknown> = {};

    for (const [location, schema] of Object.entries(schemas)) {
      if (schema === undefined) continue;

      const result = schema.safeParse(req[location as keyof Request]);
      if (result.success) {
        validated[location] = result.data;
        continue;
      }

      for (const issue of result.error.issues) {
        const key = [location, ...issue.path].join(".");
        (fields[key] ??= []).push(issue.message);
      }
    }

    if (Object.keys(fields).length > 0) {
      next(
        new AppError({
          code: errorCodes.validationFailed,
          message: "Request validation failed",
          statusCode: 422,
          details: fields,
        }),
      );
      return;
    }

    res.locals.validated = validated;
    next();
  };
}
