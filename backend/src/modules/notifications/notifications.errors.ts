import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export const notificationNotFound = () =>
  new AppError({
    code: errorCodes.notFound,
    message: "Resource not found",
    statusCode: 404,
  });
export const notificationForbidden = () =>
  new AppError({
    code: errorCodes.forbidden,
    message: "You do not have permission to perform this action",
    statusCode: 403,
  });
