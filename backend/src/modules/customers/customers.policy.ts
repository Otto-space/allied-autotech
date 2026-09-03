import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export function assertCustomerActor(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") {
    throw new AppError({
      code: errorCodes.forbidden,
      message: "You do not have permission to perform this action",
      statusCode: 403,
    });
  }
}
