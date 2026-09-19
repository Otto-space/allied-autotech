import { z } from "zod";
const name = z.object({ firstName: z.string(), lastName: z.string() });
export const candidateSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(["CUSTOMER", "STAFF"]),
  profile: name.nullable(),
  staffProfile: name.extend({ branchId: z.uuid().nullable() }).nullable(),
});
export const parseCandidates = (value: unknown) =>
  z.object({ items: z.array(candidateSchema).max(1) }).parse(value);
export const invitationRecordSchema = z.object({
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
});
export const parseInvitations = (value: unknown) =>
  z
    .object({ items: z.array(invitationRecordSchema), nextCursor: z.uuid().optional() })
    .parse(value);
export const parseQueuedInvitation = (value: unknown) =>
  z
    .object({ invitation: invitationRecordSchema, delivery: z.literal("QUEUED") })
    .parse(value);
