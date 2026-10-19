import { z } from "zod";
const timestamp = z.iso.datetime({ offset: true });
const name = z.object({ firstName: z.string(), lastName: z.string() });
export const teamCandidateResponseSchema = z.object({
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
export const teamInvitationResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(["STAFF", "ADMIN"]),
  recipientId: z.uuid().nullable(),
  invitedById: z.uuid(),
  status: z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]),
  createdAt: timestamp,
  expiresAt: timestamp,
  usedAt: timestamp.nullable(),
  revokedAt: timestamp.nullable(),
});
