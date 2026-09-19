import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import type { UserRole } from "../../generated/prisma/enums.js";

function deny(): never {
  throw new AppError({
    code: errorCodes.forbidden,
    message: "You do not have permission to perform this action",
    statusCode: 403,
  });
}

export function assertAdministrator(actor: AuthenticatedActor): void {
  if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") deny();
  if (actor.mfaVerifiedAt === null) deny();
}

export function assertCanInvite(actor: AuthenticatedActor, targetRole: UserRole): void {
  assertAdministrator(actor);
  if (targetRole !== "ADMIN") deny();
}

export function assertCanManagePrivilegedUser(
  actor: AuthenticatedActor,
  targetUserId: string,
  targetRole: UserRole,
): void {
  assertAdministrator(actor);
  if (actor.userId === targetUserId || targetRole === "SUPER_ADMIN") deny();
  if (actor.role === "ADMIN" && targetRole !== "STAFF") deny();
}

export function assertCanChangeRole(
  actor: AuthenticatedActor,
  targetUserId: string,
  currentRole: UserRole,
  nextRole: UserRole,
): void {
  if (actor.role !== "SUPER_ADMIN" || actor.mfaVerifiedAt === null) deny();
  if (actor.userId === targetUserId || currentRole === "SUPER_ADMIN") deny();
  if (currentRole !== "ADMIN" || nextRole !== "STAFF") deny();
}

export function assertPrivilegedActor(actor: AuthenticatedActor): void {
  if (actor.role === "CUSTOMER" || actor.mfaVerifiedAt === null) deny();
}
