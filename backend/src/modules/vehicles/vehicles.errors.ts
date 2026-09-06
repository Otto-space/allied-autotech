import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";

const vehicleError = (
  statusCode: number,
  code: keyof typeof errorCodes,
  message: string,
) => new AppError({ statusCode, code: errorCodes[code], message });

export const vehicleNotFound = () =>
  vehicleError(404, "notFound", "Vehicle resource was not found");
export const vehicleForbidden = () =>
  vehicleError(403, "forbidden", "You do not have permission to perform this action");
export const vehicleConflict = (
  message = "Vehicle operation conflicts with current state",
) => vehicleError(409, "conflict", message);
export const vehicleStale = () =>
  vehicleError(409, "staleVersion", "The resource changed; reload and retry");
export const invalidAssetTicket = () =>
  vehicleError(
    400,
    "validationFailed",
    "Asset upload confirmation is invalid or expired",
  );
