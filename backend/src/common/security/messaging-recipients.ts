import { env } from "../../config/env.js";

export function isStagingRecipientAllowed(
  channel: "EMAIL" | "SMS",
  recipient: string,
): boolean {
  if (env.DEPLOYMENT_ENV !== "staging") return true;
  const normalized = recipient.trim().toLowerCase();
  const allowed =
    channel === "EMAIL" ? env.STAGING_EMAIL_ALLOWLIST : env.STAGING_SMS_ALLOWLIST;
  return allowed.some((entry) => {
    if (channel === "EMAIL" && entry.startsWith("@")) return normalized.endsWith(entry);
    return normalized === entry;
  });
}
