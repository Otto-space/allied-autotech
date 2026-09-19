import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { AppError } from "../../common/errors/app-error.js";
import type { Prisma } from "../../generated/prisma/client.js";

export function accessDenied(): never {
  throw new AppError({
    code: "FORBIDDEN",
    message: "Access change could not be authorized",
    statusCode: 403,
  });
}

// One lock order for infrequent access changes, including inviter demotion/revocation.
// Account/session row locks also serialize against identity changes outside this module.
export async function lockAccessActor(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  expectedPasswordHash?: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('organization-access', 0))`;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${actor.sessionId}::uuid FOR UPDATE`;
  const user = await tx.user.findUnique({
    where: { id: actor.userId },
    select: { role: true, status: true, emailVerifiedAt: true, passwordHash: true },
  });
  const now = new Date();
  const session = await tx.session.findFirst({
    where: {
      id: actor.sessionId,
      userId: actor.userId,
      revokedAt: null,
      expiresAt: { gt: now },
      idleExpiresAt: { gt: now },
    },
    select: { mfaVerifiedAt: true },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !user.emailVerifiedAt ||
    user.role !== actor.role ||
    !session ||
    session.mfaVerifiedAt === null ||
    actor.mfaVerifiedAt === null ||
    (expectedPasswordHash !== undefined && user.passwordHash !== expectedPasswordHash)
  )
    accessDenied();
}

export function revokeAccessInvitations(tx: Prisma.TransactionClient, userId: string) {
  return tx.privilegedInvitation.updateMany({
    where: {
      usedAt: null,
      revokedAt: null,
      OR: [{ invitedById: userId }, { recipientId: userId }],
    },
    data: { revokedAt: new Date() },
  });
}
