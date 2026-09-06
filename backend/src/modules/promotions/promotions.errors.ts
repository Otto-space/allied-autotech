import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export const promotionNotFound = () =>
  new AppError({
    code: errorCodes.notFound,
    message: "Promotion is not available",
    statusCode: 404,
  });
export const promotionForbidden = () =>
  new AppError({
    code: errorCodes.forbidden,
    message: "You do not have permission to perform this action",
    statusCode: 403,
  });
export const promotionIneligible = () =>
  new AppError({
    code: errorCodes.conflict,
    message: "Promotion is not eligible for this order",
    statusCode: 409,
  });
export const promotionStale = () =>
  new AppError({
    code: errorCodes.staleVersion,
    message: "The resource changed; reload and retry",
    statusCode: 409,
  });
