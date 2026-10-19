import { z } from "zod";
const name = z.object({ firstName: z.string(), lastName: z.string() });
export const candidateSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(["CUSTOMER", "STAFF"]),
  profile: name.nullable(),
  staffProfile: name
    .extend({
      branchId: z.uuid().nullable(),
      branch: z
        .object({
          id: z.uuid(),
          name: z.string(),
          code: z.string(),
          isActive: z.boolean(),
        })
        .nullable(),
    })
    .nullable(),
  management: z.object({ canPromote: z.boolean(), canInvite: z.boolean() }),
});
export function parseCandidates(value: unknown, email?: string) {
  const result = z
    .object({ items: z.array(candidateSchema).max(1) })
    .strict()
    .parse(value);
  for (const row of result.items) {
    if (
      (email && row.email.toLowerCase() !== email.toLowerCase()) ||
      (row.management.canPromote && (row.role !== "CUSTOMER" || !row.profile)) ||
      (row.management.canInvite &&
        (row.role !== "STAFF" || !row.staffProfile?.branch?.isActive)) ||
      (row.staffProfile &&
        row.staffProfile.branchId !== (row.staffProfile.branch?.id ?? null))
    )
      throw Error("Unexpected account eligibility");
  }
  return result;
}
export const invitationRecordSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    role: z.enum(["STAFF", "ADMIN"]),
    recipientId: z.uuid().nullable(),
    invitedById: z.uuid(),
    status: z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]),
    createdAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    usedAt: z.iso.datetime({ offset: true }).nullable(),
    revokedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()
  .refine((row) => {
    const created = Date.parse(row.createdAt);
    return (
      Date.parse(row.expiresAt) > created &&
      (!row.usedAt || Date.parse(row.usedAt) >= created) &&
      (!row.revokedAt || Date.parse(row.revokedAt) >= created) &&
      (row.status === "ACCEPTED"
        ? !!row.usedAt
        : row.status === "REVOKED"
          ? !row.usedAt && !!row.revokedAt
          : !row.usedAt && !row.revokedAt)
    );
  }, "Unexpected invitation lifecycle");
export function parseInvitations(
  value: unknown,
  query = new URLSearchParams(),
  actor?: { id: string; role: string },
) {
  const page = z
    .object({
      items: z.array(invitationRecordSchema).max(25),
      nextCursor: z.uuid().optional(),
    })
    .strict()
    .parse(value);
  if (
    page.items.some(
      (row, index) =>
        (index > 0 && page.items[index - 1]!.id >= row.id) ||
        (query.has("cursor") && row.id <= query.get("cursor")!) ||
        (query.has("status") && row.status !== query.get("status")) ||
        (actor?.role === "ADMIN" && row.invitedById !== actor.id),
    ) ||
    (page.nextCursor &&
      (page.nextCursor !== page.items.at(-1)?.id ||
        page.nextCursor === query.get("cursor")))
  )
    throw Error("Invitation scope could not be confirmed");
  return page;
}
export const parseQueuedInvitation = (value: unknown) =>
  z
    .object({ invitation: invitationRecordSchema, delivery: z.literal("QUEUED") })
    .strict()
    .parse(value);
