import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export const serviceOperationNotFound = () =>
  new AppError({
    code: errorCodes.notFound,
    message: "Resource not found",
    statusCode: 404,
  });
export const serviceOperationForbidden = () =>
  new AppError({
    code: errorCodes.forbidden,
    message: "You do not have permission to perform this action",
    statusCode: 403,
  });
export const serviceOperationConflict = (message: string) =>
  new AppError({ code: errorCodes.conflict, message, statusCode: 409 });
export const staleServiceOperation = () =>
  new AppError({
    code: errorCodes.staleVersion,
    message: "The resource changed; reload and retry",
    statusCode: 409,
  });
export const invalidServiceTransition = () =>
  new AppError({
    code: errorCodes.invalidTransition,
    message: "The requested status transition is not allowed",
    statusCode: 409,
  });
export const scheduleConflict = () =>
  new AppError({
    code: errorCodes.scheduleConflict,
    message: "The requested time is unavailable",
    statusCode: 409,
  });
