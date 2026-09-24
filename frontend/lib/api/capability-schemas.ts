import { z } from "zod";
import { staffProfileSchema } from "./staff-booking-schemas";

export const capabilityLabels = {
  BOOKING_CONFIRM: "Confirm workshop bookings",
  REFUND_APPROVE: "Approve refunds",
  REFUND_TRANSFER: "Record refund transfers",
  REFUND_CHECK: "Independently check refunds",
  FINANCE_POLICY_APPROVE: "Approve financial policy",
  PRIVACY_REVIEW: "Review privacy requests",
  DISPUTE_MANAGE: "Manage payment disputes",
} as const;
export const capabilitySchema = z.enum([
  "BOOKING_CONFIRM",
  "REFUND_APPROVE",
  "REFUND_TRANSFER",
  "REFUND_CHECK",
  "FINANCE_POLICY_APPROVE",
  "PRIVACY_REVIEW",
  "DISPUTE_MANAGE",
]);
export type Capability = z.infer<typeof capabilitySchema>;
export const ownStaffProfileSchema = staffProfileSchema.extend({
  capabilities: z.array(z.string()),
});
export const parseOwnStaffProfile = (value: unknown) =>
  ownStaffProfileSchema.parse(value);
export const capabilityGrantSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  capability: z.string(),
  grantedByUserId: z.uuid(),
  grantedAt: z.iso.datetime({ offset: true }),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
});
export const parseCapabilityGrants = (value: unknown) =>
  z.array(capabilityGrantSchema).parse(value);
export const parseCapabilityRevocation = (value: unknown) =>
  z.object({ id: z.uuid(), revoked: z.literal(true) }).parse(value);
