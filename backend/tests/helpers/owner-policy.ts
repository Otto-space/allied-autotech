import { prisma } from "../../src/config/database.js";

/** Disposable test data only; never run these helpers during application bootstrap. */
export async function testCapability(userId: string, capability: string) {
  if (process.env.RUN_DATABASE_TESTS !== "true")
    throw new Error("Database fixture guard required");
  if (
    !(await prisma.userCapability.findFirst({
      where: { userId, capability, revokedAt: null },
    }))
  )
    await prisma.userCapability.create({
      data: { userId, capability, grantedByUserId: userId },
    });
}
export async function testBranchCapacity(
  branchId: string,
  approverId: string,
  dailyLimit = 20,
) {
  if (process.env.RUN_DATABASE_TESTS !== "true")
    throw new Error("Database fixture guard required");
  return prisma.businessPolicyVersion.create({
    data: {
      key: `booking-capacity:${branchId}`,
      version: 1,
      approvalStatus: "APPROVED",
      source: "Synthetic isolated integration fixture, not owner approval",
      sourceQuestion: "Q5",
      approvedByUserId: approverId,
      effectiveAt: new Date(Date.now() - 1000),
      settings: {
        dailyLimit,
        openingDays: [0, 1, 2, 3, 4, 5, 6],
        opensAt: "08:00",
        closesAt: "18:00",
        holidays: [],
        timezone: "Africa/Lagos",
      },
    },
  });
}
