import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export function staleCustomerProfile(): AppError {
  return new AppError({
    code: errorCodes.staleVersion,
    message:
      "Your profile has changed. Review the latest saved details before updating it.",
    statusCode: 409,
  });
}

export function customerResourceNotFound(): AppError {
  return new AppError({
    code: errorCodes.notFound,
    message: "Customer resource was not found",
    statusCode: 404,
  });
}
