// Operator-only provisioning. Deliberately not exposed through any HTTP route.
import { normalizeEmail } from "../../common/security/email.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

export async function inspectOwnerCandidate(database: PrismaClient, email: string) {
  const [ownerCount, candidate] = await Promise.all([
    database.user.count({ where: { role: "SUPER_ADMIN" } }),
    database.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true, email: true, role: true, status: true, emailVerifiedAt: true },
    }),
  ]);
  return { ownerCount, candidate };
}

export async function provisionInitialOwner(
  database: PrismaClient,
  selection: { email: string; expectedUserId: string },
) {
  const email = normalizeEmail(selection.email);
  return database.$transaction(
    async (transaction) => {
      // READ COMMITTED sees a competing provisioner after it releases this lock.
      // The database unique index independently enforces at-most-one ownership.
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(421337, 1)`;
      const protection = await transaction.$queryRaw<{ ready: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indexrelid = to_regclass('"User_single_super_admin"')
            AND i.indisunique AND i.indisvalid
        ) AND EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = '"User"'::regclass
            AND conname = 'User_super_admin_active_verified' AND convalidated
        ) AND EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgrelid = '"User"'::regclass
            AND tgname = 'User_protect_sole_super_admin' AND tgenabled = 'O'
        ) AS ready`;
      if (protection[0]?.ready !== true) {
        throw new Error("Apply the owner-protection migration before provisioning");
      }
      if ((await transaction.user.count({ where: { role: "SUPER_ADMIN" } })) !== 0) {
        throw new Error(
          "An owner already exists; initial provisioning cannot replace ownership",
        );
      }
      await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${selection.expectedUserId}::uuid FOR UPDATE`;
      const candidate = await transaction.user.findUnique({
        where: { id: selection.expectedUserId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
        },
      });
      if (candidate === null || normalizeEmail(candidate.email) !== email) {
        throw new Error(
          "The selected existing account does not match the confirmed email and user ID",
        );
      }
      if (candidate.status !== "ACTIVE" || candidate.emailVerifiedAt === null) {
        throw new Error("The selected account must already be active and email verified");
      }
      await transaction.user.update({
        where: { id: candidate.id },
        data: { role: "SUPER_ADMIN" },
      });
      await transaction.session.updateMany({
        where: { userId: candidate.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          userId: candidate.id,
          action: "ROLE_CHANGE",
          entityType: "USER",
          entityId: candidate.id,
          oldValues: { role: candidate.role },
          newValues: {
            role: "SUPER_ADMIN",
            source: "verified_account_initial_provisioning",
            mfaEnrollmentRequired: true,
          },
        },
      });
      return { id: candidate.id, email: candidate.email };
    },
    { isolationLevel: "ReadCommitted" },
  );
}
