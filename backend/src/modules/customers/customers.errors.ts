import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export function customerResourceNotFound(): AppError {
  return new AppError({
    code: errorCodes.notFound,
    message: "Customer resource was not found",
    statusCode: 404,
  });
}
