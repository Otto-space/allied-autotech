import { randomUUID } from "node:crypto";
import { prisma } from "../../src/config/database.js";
import { reviewSourceCustomer } from "./review-sources.js";
export type ReplyKind = "enquiry" | "complaint";
export const replyKey = (stamp = Date.now()) =>
  `support-reply-v1.${stamp}.${randomUUID()}`;
export async function supportReplyFixture(kind: ReplyKind) {
  const owner = await reviewSourceCustomer();
  const branch = await prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 10),
      name: "Support reply test",
      address: "Synthetic",
      city: "Lagos",
      state: "Lagos",
    },
  });
  const staff = await prisma.staffProfile.create({
    data: {
      branch: { connect: { id: branch.id } },
      firstName: "Synthetic",
      lastName: "Handler",
      user: {
        create: {
          email: `${randomUUID()}@example.test`,
          role: "STAFF",
          passwordHash: "unusable-synthetic-fixture",
        },
      },
    },
  });
  const base = {
    customerId: owner.customerId,
    branchId: branch.id,
    assignedStaffId: staff.id,
    name: "Synthetic Customer",
    email: owner.user.email,
    subject: `Synthetic ${kind} conversation`,
  };
  const record =
    kind === "enquiry"
      ? await prisma.enquiry.create({
          data: { ...base, type: "GENERAL", message: "Original details" },
        })
      : await prisma.complaint.create({
          data: { ...base, description: "Original details" },
        });
  return {
    ...owner,
    staffUserId: staff.userId,
    staffId: staff.id,
    branchId: branch.id,
    recordId: record.id,
    kind,
  };
}
