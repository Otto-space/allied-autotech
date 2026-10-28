import type { Prisma } from "../../generated/prisma/client.js";
import { workforceDenied } from "./workforce.policy.js";
import { isKnownWorkforcePolicyVersion } from "./workforce-catalogue.js";

// Enrolled administrators retain the established invitation/acceptance flow, within
// an explicit owner envelope. Promotion never switches an enrolled user to legacy access.
export async function assertWorkforceInvitationDelegation(
  tx: Prisma.TransactionClient,
  inviterId: string,
  recipientId: string,
) {
  const inviter = await tx.user.findUnique({
    where: { id: inviterId },
    select: { role: true, workforceAccess: true },
  });
  if (!inviter) workforceDenied();
  // A business-position record cannot narrow the established protected-owner
  // invitation baseline. The caller still enforces current owner/tier/MFA/proof.
  if (inviter.role === "SUPER_ADMIN") return;
  const envelope = inviter.workforceAccess;
  if (!envelope) return;
  const recipient = await tx.user.findUnique({
    where: { id: recipientId },
    select: {
      workforceAccess: { select: { userId: true } },
      staffProfile: {
        select: { branchId: true, branch: { select: { isActive: true } } },
      },
    },
  });
  if (
    !isKnownWorkforcePolicyVersion(envelope.delegationPolicyVersion) ||
    !envelope.delegatedTemplates.includes("ADMIN_INVITE") ||
    !recipient?.workforceAccess ||
    !recipient.staffProfile?.branchId ||
    !recipient.staffProfile.branch?.isActive ||
    !envelope.delegatedBranchIds.includes(recipient.staffProfile.branchId)
  )
    workforceDenied(
      "Admin invitations require explicit owner delegation and an enrolled staff account in a permitted branch",
    );
}
