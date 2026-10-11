import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../common/errors/app-error.js";
import { hashToken } from "../../common/security/session-tokens.js";

export const savedVehicleCursorSchema = z
  .string()
  .length(101)
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_[0-9a-f]{64}$/,
  );

export function savedVehicleCursor(customerId: string, id: string): string {
  return `${id}_${hashToken("saved-vehicle-cursor", `${customerId}:${id}`)}`;
}

export function readSavedVehicleCursor(
  customerId: string,
  cursor?: string,
): string | undefined {
  if (cursor === undefined) return undefined;
  const parsed = savedVehicleCursorSchema.safeParse(cursor);
  if (parsed.success) {
    const id = cursor.slice(0, 36);
    const expected = savedVehicleCursor(customerId, id);
    if (timingSafeEqual(Buffer.from(cursor), Buffer.from(expected))) return id;
  }
  throw new AppError({
    statusCode: 422,
    code: "VALIDATION_FAILED",
    message: "Invalid saved-vehicle cursor; return to the first page",
  });
}
