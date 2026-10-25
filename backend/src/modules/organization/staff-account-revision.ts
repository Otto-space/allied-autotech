import type { Prisma } from "../../generated/prisma/client.js";
import { organizationConflict } from "./organization.errors.js";

export async function lockStaffAccount(tx: Prisma.TransactionClient, userId: string) {
  // The organization/actor locks are acquired by the caller first.
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "StaffProfile" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
}
export function assertStaffRevision(
  record: {
    updatedAt: Date;
    role: string;
    status: string;
    staffProfile: { updatedAt: Date; branchId: string | null } | null;
  },
  expected: string,
) {
  const revision = [
    record.updatedAt.toISOString(),
    record.role,
    record.status,
    record.staffProfile?.updatedAt.toISOString(),
    record.staffProfile?.branchId,
  ].join(":");
  if (revision !== expected) throw organizationConflict();
}
