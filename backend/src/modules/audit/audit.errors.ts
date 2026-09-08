import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

export const auditConflict = (message = "The operational record changed; refresh and retry") =>
  new AppError({ code: errorCodes.conflict, message, statusCode: 409 });
export const auditNotFound = () =>
  new AppError({ code: errorCodes.notFound, message: "Operational record not found", statusCode: 404 });
export const auditBadRequest = (message: string) =>
  new AppError({ code: errorCodes.badRequest, message, statusCode: 400 });
