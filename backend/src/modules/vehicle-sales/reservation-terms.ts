import { createHash } from "node:crypto";
import { z } from "zod";
import type { BusinessPolicyVersion, Prisma } from "../../generated/prisma/client.js";
import { vehicleSaleConflict } from "./vehicle-sales.errors.js";

export const reservationTermsKey = "vehicle_reservation_terms";
const plainText = (max: number) =>
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
      "Use plain text without control characters",
    );
export const reservationTermsSettingsSchema = z.discriminatedUnion("enabled", [
  z
    .object({ enabled: z.literal(true), title: plainText(200), body: plainText(50000) })
    .strict(),
  z.object({ enabled: z.literal(false), reason: plainText(1000) }).strict(),
]);
export const reservationTermsDocumentSchema = z.object({
  version: z.uuid().describe("Immutable approved policy ID; submit as termsVersion."),
  revision: z.number().int().positive(),
  title: z.string(),
  body: z.string().describe("Plain text; render as text, never as HTML."),
  contentSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .describe("SHA-256 of the UTF-8 body."),
  effectiveAt: z.iso.datetime(),
});
export const reservationTermsResponseSchema = z.object({
  current: reservationTermsDocumentSchema.nullable(),
  accepted: z
    .object({
      document: reservationTermsDocumentSchema,
      acceptedAt: z.iso.datetime(),
    })
    .nullable(),
  legacyAcceptance: z
    .boolean()
    .describe(
      "Historical acceptance exists without a verified document link; no document is invented.",
    ),
});

export function reservationTermsDocument(policy: BusinessPolicyVersion | null) {
  const parsed = reservationTermsSettingsSchema.safeParse(policy?.settings);
  if (
    !policy ||
    policy.key !== reservationTermsKey ||
    policy.approvalStatus !== "APPROVED" ||
    !parsed.success ||
    !parsed.data.enabled
  )
    return null;
  return {
    version: policy.id,
    revision: policy.version,
    title: parsed.data.title,
    body: parsed.data.body,
    contentSha256: createHash("sha256").update(parsed.data.body, "utf8").digest("hex"),
    effectiveAt: policy.effectiveAt.toISOString(),
  };
}

export async function currentReservationTerms(
  database: Pick<Prisma.TransactionClient, "businessPolicyVersion">,
  now = new Date(),
) {
  return reservationTermsDocument(
    await database.businessPolicyVersion.findFirst({
      where: { key: reservationTermsKey, effectiveAt: { lte: now } },
      orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
    }),
  );
}

export async function requireReservationTerms(
  tx: Prisma.TransactionClient,
  version: string,
) {
  // Publication uses this same lock. Read the applicable version only after acquiring it.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`policy:${reservationTermsKey}`}, 0))`;
  const acceptedAt = new Date();
  const document = await currentReservationTerms(tx, acceptedAt);
  if (!document)
    throw vehicleSaleConflict("Approved reservation terms are currently unavailable");
  if (document.version !== version)
    throw vehicleSaleConflict(
      "Reservation terms changed; review and accept the current agreement",
    );
  return { ...document, acceptedAt };
}
