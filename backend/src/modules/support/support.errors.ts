import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

const supportError = (
  code: (typeof errorCodes)[keyof typeof errorCodes],
  message: string,
  statusCode: number,
) => new AppError({ code, message, statusCode });

export const supportNotFound = () =>
  supportError(errorCodes.notFound, "Resource not found", 404);
export const supportForbidden = () =>
  supportError(
    errorCodes.forbidden,
    "You do not have permission to perform this action",
    403,
  );
export const supportConflict = (message = "The support record cannot be changed") =>
  supportError(errorCodes.conflict, message, 409);
export const supportStale = () =>
  supportError(errorCodes.staleVersion, "The record changed; refresh and try again", 409);
export const supportBranchRequired = () =>
  supportError(errorCodes.conflict, "Select an active branch", 409);
