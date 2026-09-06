import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { serviceOperationForbidden } from "./service-operations.errors.js";

export function assertCustomerActor(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") throw serviceOperationForbidden();
}

export function assertPrivilegedActor(actor: AuthenticatedActor): void {
  if (actor.role === "CUSTOMER" || actor.mfaVerifiedAt === null)
    throw serviceOperationForbidden();
}

export function assertServiceAdministrator(actor: AuthenticatedActor): void {
  if (
    (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") ||
    actor.mfaVerifiedAt === null
  )
    throw serviceOperationForbidden();
}
