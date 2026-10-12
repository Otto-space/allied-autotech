import { z } from "zod";
import { parsePolicyHistory, policyVersionSchema } from "./policy-schemas";

export const reservationTermsKey = "vehicle_reservation_terms";
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) =>
        [...value].every((character) => {
          const code = character.codePointAt(0) ?? 0;
          return (code >= 32 && code !== 127) || [9, 10, 13].includes(code);
        }),
      "Use plain text without control characters.",
    );
export const termsSettingsSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(true), title: text(200), body: text(50000) }).strict(),
  z.object({ enabled: z.literal(false), reason: text(1000) }).strict(),
]);
export const termsDocumentSchema = z.object({
  version: z.uuid(),
  revision: z.number().int().positive(),
  title: text(200),
  body: text(50000),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  effectiveAt: z.iso.datetime({ offset: true }),
});
export type TermsDocument = z.infer<typeof termsDocumentSchema>;
export const parseReservationTerms = (value: unknown) =>
  z
    .object({
      current: termsDocumentSchema.nullable(),
      accepted: z
        .object({
          document: termsDocumentSchema,
          acceptedAt: z.iso.datetime({ offset: true }),
        })
        .nullable(),
      legacyAcceptance: z.boolean(),
    })
    .parse(value);
export const parseReservationPolicyHistory = (value: unknown) => {
  const rows = parsePolicyHistory(value);
  if (
    rows.some((row) => row.key !== reservationTermsKey) ||
    new Set(rows.map((row) => row.version)).size !== rows.length
  )
    throw new Error("Unexpected agreement history");
  return rows.map((row) => ({
    ...row,
    settings: termsSettingsSchema.parse(row.settings),
  }));
};
export const parseReservationPolicy = (value: unknown) =>
  parseReservationPolicyHistory([policyVersionSchema.parse(value)])[0]!;

const retryPrefix = "aat:reservation:v1:";
const retention = 23 * 3600000;
const retrySchema = z
  .object({
    owner: z.uuid(),
    transactionId: z.uuid(),
    key: z.uuid(),
    startedAt: z.number().int().nonnegative(),
    body: z
      .object({
        expectedVersion: z.number().int().nonnegative(),
        termsVersion: z.uuid(),
        termsAccepted: z.literal(true),
      })
      .strict(),
  })
  .strict();
export type ReservationIntent = z.infer<typeof retrySchema>;
export type ReservationRecovery =
  | { kind: "pending"; intent: ReservationIntent }
  | { kind: "history" }
  | { kind: "unavailable" };
const slot = (owner: string, transactionId: string) =>
  `${retryPrefix}${owner}:${transactionId}`;
export function readReservationRetry(
  owner: string,
  transactionId: string,
): ReservationRecovery | undefined {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(slot(owner, transactionId));
  } catch {
    return { kind: "unavailable" };
  }
  if (raw === null) return undefined;
  try {
    if (raw.length > 2000) return { kind: "history" };
    const value = retrySchema.parse(JSON.parse(raw));
    if (
      value.owner !== owner ||
      value.transactionId !== transactionId ||
      Date.now() < value.startedAt ||
      Date.now() - value.startedAt >= retention
    )
      return { kind: "history" };
    return { kind: "pending", intent: value };
  } catch {
    return { kind: "history" };
  }
}
export function saveReservationRetry(value: ReservationIntent) {
  const intent = retrySchema.parse(value);
  sessionStorage.setItem(
    slot(intent.owner, intent.transactionId),
    JSON.stringify(intent),
  );
}
export function clearReservationRetry(owner: string, transactionId: string) {
  try {
    sessionStorage.removeItem(slot(owner, transactionId));
    return true;
  } catch {
    return false;
  }
}
export function redactReservationRetries() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(retryPrefix)) sessionStorage.setItem(key, '{"history":true}');
  } catch {
    /* Browser storage may be unavailable. */
  }
}
