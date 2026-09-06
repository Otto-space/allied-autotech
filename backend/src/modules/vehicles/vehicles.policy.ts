import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { vehicleForbidden } from "./vehicles.errors.js";

export function assertVehicleCustomer(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") throw vehicleForbidden();
}
export function assertVehicleOperator(actor: AuthenticatedActor): void {
  if (actor.role === "CUSTOMER" || actor.mfaVerifiedAt === null) throw vehicleForbidden();
}
export function assertVehicleAdministrator(actor: AuthenticatedActor): void {
  if (
    (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") ||
    actor.mfaVerifiedAt === null
  )
    throw vehicleForbidden();
}
