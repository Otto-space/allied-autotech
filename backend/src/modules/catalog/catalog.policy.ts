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

export function assertCustomer(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") deny();
}

export function assertCatalogueAdministrator(actor: AuthenticatedActor): void {
  if (
    (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") ||
    actor.mfaVerifiedAt === null
  )
    deny();
}
