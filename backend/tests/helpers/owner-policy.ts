import { workshopResourceSettingsSchema } from "../../src/modules/service-operations/workshop-resources.js";
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

/** Explicit no-equipment assumptions for adjacent synthetic calendar/permission tests,
 * not application bootstrap or evidence of real workshop resource approval. */
export async function testBranchResources(
  branchId: string,
  approverId: string,
  serviceIds: string[],
  staffIds: string[],
) {
  if (
    process.env.RUN_DATABASE_TESTS !== "true" ||
    !process.env.DB_NAME?.match(/_(test|ci)$/) ||
    process.env.TEST_DB_NAME !== process.env.DB_NAME
  )
    throw new Error("An isolated resource fixture target is required");
  const key = `booking-resources:${branchId}`;
  const prior = await prisma.businessPolicyVersion.findFirst({
    where: { key },
    orderBy: { version: "desc" },
  });
  const previous = prior ? workshopResourceSettingsSchema.parse(prior.settings) : null;
  const services = [
    ...new Set([
      ...(previous?.services.map((row) => row.serviceId) ?? []),
      ...serviceIds,
    ]),
  ];
  const workers = [
    ...new Set([...(previous?.technicians.map((row) => row.staffId) ?? []), ...staffIds]),
  ];
  const workingPeriods = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    opensAt: "08:00",
    closesAt: "18:00",
  }));
  return prisma.businessPolicyVersion.create({
    data: {
      key,
      version: (prior?.version ?? 0) + 1,
      approvalStatus: "APPROVED",
      source:
        "Synthetic isolated no-equipment/service-eligibility assumption; not owner approval",
      sourceQuestion: "D06 fixture only",
      approvedByUserId: approverId,
      effectiveAt: new Date(Date.now() - 1000),
      settings: {
        timezone: "Africa/Lagos",
        resources: [],
        services: services.map((serviceId) => ({ serviceId, requirements: [] })),
        technicians: workers.map((staffId) => ({
          staffId,
          serviceIds: services,
          workingPeriods,
          unavailablePeriods: [],
        })),
      },
    },
  });
}
