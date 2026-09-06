import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

function deny(): never {
  throw new AppError({
    code: errorCodes.forbidden,
    message: "You do not have permission to perform this action",
    statusCode: 403,
  });
}

export function assertInventoryAccess(
  actor: AuthenticatedActor,
  staffBranchId: string | null,
  inventoryBranchId: string,
): void {
  assertInventoryOperator(actor);
  if (
    actor.role === "STAFF" &&
    (staffBranchId === null || staffBranchId !== inventoryBranchId)
  )
    deny();
}

export function assertInventoryOperator(actor: AuthenticatedActor): void {
  if (actor.role === "CUSTOMER" || actor.mfaVerifiedAt === null) deny();
}

export function assertInventoryAdministrator(actor: AuthenticatedActor): void {
  if (
    (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") ||
    actor.mfaVerifiedAt === null
  )
    deny();
}
