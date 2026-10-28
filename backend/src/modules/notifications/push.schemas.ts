import { z } from "zod";

// Only established browser push providers may receive server requests. URLs are
// never fetched for discovery and redirects are not followed by the sender.
export function isPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      (url.hostname === "fcm.googleapis.com" ||
        url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname === "web.push.apple.com" ||
        /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname))
    );
  } catch {
    return false;
  }
}
const base64url = (bytes: number) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .refine((v) => Buffer.from(v, "base64url").length === bytes);
export const pushSubscriptionSchema = z
  .object({
    endpoint: z
      .string()
      .max(2048)
      .refine(isPushEndpoint, "Unsupported browser push endpoint"),
    keys: z
      .object({
        p256dh: base64url(65).refine((v) => Buffer.from(v, "base64url")[0] === 4),
        auth: base64url(16),
      })
      .strict(),
  })
  .strict();
export const pushEventSchema = z
  .object({ subscriptionId: z.uuid(), notificationId: z.uuid() })
  .strict();
export const pushEventType = "notification.push.requested";
