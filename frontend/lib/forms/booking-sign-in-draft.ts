"use client";
import { z } from "zod";

const key = "aat:booking-sign-in:v1";
const lifetime = 15 * 60_000;
const schema = z
  .object({
    serviceId: z.uuid(),
    branchId: z.union([z.uuid(), z.literal("")]),
    branchName: z.string().max(160),
    slotId: z.union([z.uuid(), z.literal("")]),
    preferredTime: z.string().max(32),
    notes: z.string().max(2000),
    expiresAt: z.number().finite(),
  })
  .strict();
const concernSchema = schema
  .omit({ serviceId: true, slotId: true })
  .extend({
    kind: z.literal("concern"),
    customerConcern: z.string().max(2000),
  })
  .strict();
const storedSchema = z.union([schema, concernSchema]);
export type ConcernSignInDraft = Omit<
  z.infer<typeof concernSchema>,
  "expiresAt" | "kind"
>;
export function saveConcernSignInDraft(draft: ConcernSignInDraft) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify(
        concernSchema.parse({
          ...draft,
          kind: "concern",
          expiresAt: Date.now() + lifetime,
        }),
      ),
    );
    return true;
  } catch {
    return false;
  }
}
export function consumeConcernSignInDraft() {
  const draft = read();
  if (!draft || !("kind" in draft)) return null;
  clearBookingSignInDraft();
  return draft;
}
export type BookingSignInDraft = Omit<z.infer<typeof schema>, "expiresAt">;
// Only explicitly handed-off anonymous input belongs here. Never save account
// records, accepted terms, payment data, credentials or a submission/retry key.
export function saveBookingSignInDraft(draft: BookingSignInDraft) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify(schema.parse({ ...draft, expiresAt: Date.now() + lifetime })),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearBookingSignInDraft() {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Optional tab storage. */
  }
}
function read() {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw || raw.length > 12000) return null;
    const draft = storedSchema.parse(JSON.parse(raw));
    if (draft.expiresAt <= Date.now() || draft.expiresAt > Date.now() + lifetime) {
      clearBookingSignInDraft();
      return null;
    }
    return draft;
  } catch {
    clearBookingSignInDraft();
    return null;
  }
}
export function bookingSignInDestination() {
  const draft = read();
  return draft
    ? "kind" in draft
      ? "/services/request"
      : `/services/${draft.serviceId}`
    : null;
}
export function consumeBookingSignInDraft(serviceId: string) {
  const draft = read();
  if (!draft || !("serviceId" in draft) || draft.serviceId !== serviceId) return null;
  clearBookingSignInDraft();
  return draft;
}
