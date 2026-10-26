import type { Prisma } from "../../generated/prisma/client.js";
import { enqueueNotification } from "./notifications.service.js";
import {
  assignmentAllows,
  definitionForAssignment,
} from "../organization/workforce-catalogue.js";

// Match the existing support branch/responsibility rules. Text stays generic so
// an inbox item cannot retain customer content after responsibility is removed.
export async function notifySupportTeam(
  tx: Prisma.TransactionClient,
  input: {
    kind: "ENQUIRY" | "COMPLAINT";
    id: string;
    event: string;
    title: string;
    actorUserId?: string;
    supportMessageId?: string;
    assignedOnly?: boolean;
  },
) {
  const record =
    input.kind === "ENQUIRY"
      ? await tx.enquiry.findUnique({
          where: { id: input.id },
          select: { branchId: true, assignedStaffId: true, type: true },
        })
      : await tx.complaint.findUnique({
          where: { id: input.id },
          select: { branchId: true, assignedStaffId: true },
        });
  if (!record) return;
  const now = new Date();
  const users = await tx.user.findMany({
    where: {
      role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
      status: "ACTIVE",
      emailVerifiedAt: { not: null },
    },
    select: {
      id: true,
      role: true,
      staffProfile: { select: { id: true, branchId: true } },
      workforceAccess: {
        select: {
          assignments: {
            where: {
              revokedAt: null,
              startsAt: { lte: now },
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              branch: { isActive: true },
            },
          },
        },
      },
    },
  });
  for (const user of users) {
    if (user.id === input.actorUserId) continue;
    if (input.assignedOnly && user.staffProfile?.id !== record.assignedStaffId) continue;
    const allowed =
      user.role === "SUPER_ADMIN" ||
      (user.workforceAccess
        ? user.workforceAccess.assignments.some((a) => {
            if (!definitionForAssignment(a) || a.branchId !== record.branchId)
              return false;
            if (
              a.scope === "ASSIGNED" &&
              (!user.staffProfile || user.staffProfile.id !== record.assignedStaffId)
            )
              return false;
            if (input.kind === "COMPLAINT") return assignmentAllows(a, "COMPLAINTS");
            return (
              assignmentAllows(a, "CUSTOMER_ENQUIRIES") ||
              (assignmentAllows(a, "SALES_ENQUIRIES") &&
                "type" in record &&
                typeof record.type === "string" &&
                ["PRODUCT", "VEHICLE"].includes(record.type))
            );
          })
        : user.role === "ADMIN" ||
          (!!record.branchId && user.staffProfile?.branchId === record.branchId));
    if (!allowed) continue;
    await enqueueNotification(tx, {
      userId: user.id,
      type: input.kind,
      category: "OPERATIONAL",
      title: input.title,
      message:
        "A support conversation needs your attention. Open the update to review its current details.",
      resourceType: input.kind,
      resourceId: input.id,
      ...(input.supportMessageId ? { supportMessageId: input.supportMessageId } : {}),
      deduplicationKey: `team:${input.event}:${user.id}`,
      channels:
        input.supportMessageId && record.assignedStaffId === user.staffProfile?.id
          ? ["EMAIL"]
          : [],
    });
  }
}
