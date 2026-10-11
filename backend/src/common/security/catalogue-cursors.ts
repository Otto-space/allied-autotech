import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import { hashToken } from "./session-tokens.js";

export const catalogueCursorSchema = z
  .string()
  .min(80)
  .max(1024)
  .regex(/^[A-Za-z0-9_-]+$/);
export const invalidCatalogueCursor = () =>
  new AppError({
    code: "VALIDATION_FAILED",
    statusCode: 422,
    message: "Invalid catalogue cursor; restart the search from the first page",
  });
export function catalogueBinding(scope: string, query: Record<string, unknown>): string {
  const fields = Object.entries(query)
    .filter(([key, value]) => key !== "cursor" && key !== "limit" && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256")
    .update(JSON.stringify([scope, fields]))
    .digest("hex");
}
export function encodeCatalogueCursor(binding: string, position: unknown): string {
  const data = Buffer.from(JSON.stringify({ v: 1, binding, position })).toString(
    "base64url",
  );
  return `${data}_${hashToken("catalogue-cursor", data)}`;
}
export function decodeCatalogueCursor<T>(
  binding: string,
  cursor: string,
  position: z.ZodType<T>,
): T {
  try {
    const raw = catalogueCursorSchema.parse(cursor);
    const separator = raw.lastIndexOf("_");
    const data = raw.slice(0, separator),
      signature = raw.slice(separator + 1);
    if (
      !/^[0-9a-f]{64}$/.test(signature) ||
      !timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(hashToken("catalogue-cursor", data)),
      )
    )
      throw invalidCatalogueCursor();
    const envelope = z
      .object({ v: z.literal(1), binding: z.literal(binding), position })
      .strict()
      .parse(JSON.parse(Buffer.from(data, "base64url").toString("utf8")));
    return envelope.position;
  } catch {
    throw invalidCatalogueCursor();
  }
}
