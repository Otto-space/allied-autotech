import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { vehicleSaleForbidden } from "./vehicle-sales.errors.js";
export function assertVehicleSaleCustomer(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") throw vehicleSaleForbidden();
}
export function assertVehicleSaleOperator(actor: AuthenticatedActor): void {
  if (actor.role === "CUSTOMER" || actor.mfaVerifiedAt === null)
    throw vehicleSaleForbidden();
}
