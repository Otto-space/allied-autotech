import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
export const invoiceNotFound = () =>
  new AppError({
    code: errorCodes.notFound,
    message: "Resource not found",
    statusCode: 404,
  });
export const invoiceForbidden = () =>
  new AppError({
    code: errorCodes.forbidden,
    message: "You do not have permission to perform this action",
    statusCode: 403,
  });
export const invoiceConflict = (message = "The invoice cannot be changed") =>
  new AppError({ code: errorCodes.conflict, message, statusCode: 409 });
export const invoiceStale = () =>
  new AppError({
    code: errorCodes.staleVersion,
    message: "The resource changed; reload and retry",
    statusCode: 409,
  });
export const invalidInvoiceTransition = () =>
  new AppError({
    code: errorCodes.invalidTransition,
    message: "The requested status transition is not allowed",
    statusCode: 409,
  });
