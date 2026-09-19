import { z } from "zod";
export const invitationSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128),
  branchId: z.union([z.literal(""), z.uuid()]),
});
export type InvitationValues = z.infer<typeof invitationSchema>;
export const acceptInvitationSchema = z.object({
  token: z.string().min(32, "Reopen the invitation link or enter its token.").max(512),
  currentPassword: z.string().min(1, "Enter your current password.").max(128),
});
export type AcceptInvitationValues = z.infer<typeof acceptInvitationSchema>;
