import { z } from "zod";
import { reviewSubmissionBodySchema } from "../api/review-schemas";
import { draftIdentity } from "../forms/drafts";

const prefix = "aat:review-write:v1:";
export const reviewKeySchema = z
  .string()
  .regex(
    /^review-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
const intentSchema = z
  .object({ owner: z.uuid(), key: reviewKeySchema, body: reviewSubmissionBodySchema })
  .strict();
export type ReviewIntent = z.infer<typeof intentSchema>;
export type ReviewRecovery =
  | { kind: "pending"; intent: ReviewIntent }
  | { kind: "history" }
  | { kind: "unavailable" };
export function reviewIntentActive(intent: ReviewIntent, now = Date.now()) {
  const issued = Number(intent.key.split(".")[1]);
  return now >= issued && now < issued + 24 * 60 * 60 * 1000;
}
export function readReviewRecovery(owner: string): ReviewRecovery | undefined {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(prefix + owner);
  } catch {
    return { kind: "unavailable" };
  }
  if (raw === null) return;
  try {
    if (raw.length > 20000) return { kind: "history" };
    const value = intentSchema.parse(JSON.parse(raw));
    if (value.owner !== owner || !reviewIntentActive(value)) return { kind: "history" };
    return { kind: "pending", intent: value };
  } catch {
    return { kind: "history" };
  }
}
export function saveReviewRecovery(value: ReviewIntent) {
  const intent = intentSchema.parse(value);
  if (draftIdentity() !== `${intent.owner}:CUSTOMER`)
    throw new Error("Review draft account changed");
  const raw = JSON.stringify(intent);
  sessionStorage.setItem(prefix + intent.owner, raw);
  if (sessionStorage.getItem(prefix + intent.owner) !== raw)
    throw new Error("Review recovery storage unavailable");
}
export function clearReviewRecovery(owner: string) {
  sessionStorage.removeItem(prefix + owner);
}
export function redactReviewRecoveries() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {
    /* Retain uncertainty if storage is unavailable. */
  }
}
