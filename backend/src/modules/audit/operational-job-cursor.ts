import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../common/errors/app-error.js";
import { hashToken } from "../../common/security/session-tokens.js";

export const operationalJobCursorSchema = z
  .string()
  .min(80)
  .max(1024)
  .regex(/^[A-Za-z0-9_-]+$/);
const positionSchema = z
  .object({
    updatedAt: z.iso.datetime(),
    id: z.uuid(),
    source: z.enum(["OUTBOX", "PAYMENT_WEBHOOK"]),
  })
  .strict();
export type OperationalJobPosition = z.infer<typeof positionSchema>;
export function jobCursorBinding(
  userId: string,
  query: { source?: string | undefined; status?: string | undefined },
) {
  return createHash("sha256")
    .update(JSON.stringify([userId, query.source ?? null, query.status ?? null]))
    .digest("hex");
}
export function encodeJobCursor(binding: string, position: OperationalJobPosition) {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, binding, position: positionSchema.parse(position) }),
  ).toString("base64url");
  return `${payload}_${hashToken("operational-jobs-cursor", payload)}`;
}
export function decodeJobCursor(binding: string, cursor: string): OperationalJobPosition {
  try {
    const raw = operationalJobCursorSchema.parse(cursor),
      separator = raw.lastIndexOf("_");
    const payload = raw.slice(0, separator),
      signature = raw.slice(separator + 1);
    if (
      !/^[0-9a-f]{64}$/.test(signature) ||
      !timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(hashToken("operational-jobs-cursor", payload)),
      )
    )
      throw new Error("Invalid cursor signature");
    return z
      .object({ v: z.literal(1), binding: z.literal(binding), position: positionSchema })
      .strict()
      .parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))).position;
  } catch {
    throw new AppError({
      code: "VALIDATION_FAILED",
      statusCode: 422,
      message: "Invalid processing-jobs cursor; return to the first page",
    });
  }
}
