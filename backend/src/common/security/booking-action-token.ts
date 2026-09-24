import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";

const claims = z
  .object({
    purpose: z.literal("booking-attendance-v1"),
    bookingId: z.uuid(),
    userId: z.uuid(),
    scheduleVersion: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .strict();
const signature = (payload: string) =>
  createHmac("sha256", Buffer.from(env.ASSET_TICKET_KEY, "base64"))
    .update(`booking-attendance-v1:${payload}`)
    .digest();
export function issueBookingActionToken(input: Omit<z.infer<typeof claims>, "purpose">) {
  const payload = Buffer.from(
    JSON.stringify({ ...input, purpose: "booking-attendance-v1" }),
  ).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}
export function readBookingActionToken(token: string) {
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra || token.length > 1500)
    throw new Error("Invalid booking action token");
  const digest = Buffer.from(supplied, "base64url");
  const expected = signature(payload);
  if (digest.length !== expected.length || !timingSafeEqual(digest, expected))
    throw new Error("Invalid booking action token");
  const value = claims.parse(
    JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
  );
  if (value.expiresAt <= Date.now()) throw new Error("Booking action token expired");
  return value;
}
