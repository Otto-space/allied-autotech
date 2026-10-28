import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { paymentForbidden } from "./payments.errors.js";

export function assertPaymentCustomer(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") throw paymentForbidden();
}

// Hold shared row locks through the payment write so account and session revocation
// cannot commit between request authentication and the financial state change.
export async function lockCurrentPaymentCustomer(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
): Promise<void> {
  assertPaymentCustomer(actor);
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${actor.sessionId}::uuid FOR SHARE`;
  const now = new Date();
  const [user, session] = await Promise.all([
    tx.user.findUnique({
      where: { id: actor.userId },
      select: { role: true, status: true },
    }),
    tx.session.findFirst({
      where: {
        id: actor.sessionId,
        userId: actor.userId,
        revokedAt: null,
        expiresAt: { gt: now },
        idleExpiresAt: { gt: now },
      },
      select: { mfaRequired: true, mfaVerifiedAt: true },
    }),
  ]);
  if (
    !user ||
    user.role !== "CUSTOMER" ||
    user.status !== "ACTIVE" ||
    !session ||
    (session.mfaRequired && session.mfaVerifiedAt === null)
  )
    throw paymentForbidden();
}
export function assertPaymentOperator(actor: AuthenticatedActor): void {
  if (
    (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") ||
    actor.mfaVerifiedAt === null
  )
    throw paymentForbidden();
}
export function assertPaymentApprover(actor: AuthenticatedActor): void {
  if (
    !(["ADMIN", "SUPER_ADMIN"] as const).includes(
      actor.role as "ADMIN" | "SUPER_ADMIN",
    ) ||
    actor.mfaVerifiedAt === null
  )
    throw paymentForbidden();
}
