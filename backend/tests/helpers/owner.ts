import { randomUUID } from "node:crypto";
import { prisma } from "../../src/config/database.js";

// Database fixtures share the same protected owner, just as the application does.
// Never disable its constraint or trigger to create independent test identities.
export async function testOwner(passwordHash: string) {
  if (
    process.env.RUN_DATABASE_TESTS !== "true" ||
    !/_(?:test|ci)$/.test(process.env.DB_NAME ?? "")
  ) {
    throw new Error("Owner fixture requires an explicitly enabled disposable database");
  }
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(421337, 1)`;
    const existing = await transaction.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    if (existing) return existing;
    return transaction.user.create({
      data: {
        email: `shared-owner-${randomUUID()}@example.test`,
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        staffProfile: { create: { firstName: "Synthetic", lastName: "Owner" } },
      },
    });
  });
}
