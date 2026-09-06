import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
const salesError = (statusCode: number, code: keyof typeof errorCodes, message: string) =>
  new AppError({ statusCode, code: errorCodes[code], message });
export const vehicleSaleNotFound = () =>
  salesError(404, "notFound", "Vehicle sale resource was not found");
export const vehicleSaleForbidden = () =>
  salesError(403, "forbidden", "You do not have permission to perform this action");
export const vehicleSaleConflict = (
  message = "Vehicle sale operation conflicts with current state",
) => salesError(409, "conflict", message);
export const vehicleSaleStale = () =>
  salesError(409, "staleVersion", "The resource changed; reload and retry");
export const vehicleReservationConflict = () =>
  salesError(409, "conflict", "The vehicle is no longer available");
