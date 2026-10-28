import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { hashToken } from "../../common/security/session-tokens.js";
import { AppError } from "../../common/errors/app-error.js";
import { supportChannelCursorSchema } from "./support-channel.schemas.js";

const positionSchema = z.strictObject({
  id: z.uuid(),
  createdAt: z.iso.datetime().nullable(),
});
export function supportChannelBinding(values: readonly unknown[]) {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}
export function encodeSupportChannelCursor(
  binding: string,
  position: z.infer<typeof positionSchema>,
) {
  const body = Buffer.from(
    JSON.stringify({ v: 1, binding, position: positionSchema.parse(position) }),
  ).toString("base64url");
  return `${body}.${hashToken("support-channel-cursor", body)}`;
}
export function decodeSupportChannelCursor(binding: string, cursor: string) {
  try {
    const raw = supportChannelCursorSchema.parse(cursor),
      [body, signature] = raw.split(".");
    if (
      !body ||
      !signature ||
      !timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(hashToken("support-channel-cursor", body)),
      )
    )
      throw new Error("Invalid signature");
    return z
      .strictObject({
        v: z.literal(1),
        binding: z.literal(binding),
        position: positionSchema,
      })
      .parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8"))).position;
  } catch {
    throw new AppError({
      code: "VALIDATION_FAILED",
      statusCode: 422,
      message:
        "This conversation page no longer matches your access or filters. Return to the first page.",
    });
  }
}
