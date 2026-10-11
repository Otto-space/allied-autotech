import { randomUUID } from "node:crypto";
import { prisma } from "../../src/config/database.js";
import { testOwner } from "./owner.js";
import { reservationTermsKey } from "../../src/modules/vehicle-sales/reservation-terms.js";

/** Synthetic document in disposable tests only; never an approved business agreement. */
export async function testReservationTerms() {
  const owner = await testOwner("unusable-synthetic-terms-owner");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`policy:${reservationTermsKey}`}, 0))`;
    const latest = await tx.businessPolicyVersion.findFirst({
      where: { key: reservationTermsKey },
      orderBy: { version: "desc" },
    });
    return tx.businessPolicyVersion.create({
      data: {
        key: reservationTermsKey,
        version: (latest?.version ?? 0) + 1,
        approvalStatus: "APPROVED",
        source: "Synthetic isolated test fixture, not business approval",
        sourceQuestion: "Q3",
        approvedByUserId: owner.id,
        approvalEvidence:
          "Synthetic approval evidence for isolated database testing only",
        effectiveAt: new Date(),
        settings: {
          enabled: true,
          title: "Synthetic agreement",
          body: "Synthetic integration-test content. This is not an approved customer agreement.",
        },
      },
    });
  });
}

export async function testReservationAcceptance(customerId?: string) {
  const policy = await testReservationTerms();
  const customer = customerId
    ? await prisma.customerProfile.findUniqueOrThrow({ where: { id: customerId } })
    : await prisma.customerProfile.create({
        data: {
          firstName: "Synthetic",
          lastName: "Acceptance",
          phone: "+2348000000000",
          user: {
            create: {
              email: `${randomUUID()}@example.test`,
              passwordHash: "unusable-synthetic-terms-customer",
            },
          },
        },
      });
  return {
    customerId: customer.id,
    termsVersion: policy.id,
    termsAcceptedAt: new Date(),
    reservationTermsPolicyId: policy.id,
    reservationTermsAcceptedByUserId: customer.userId,
  };
}
