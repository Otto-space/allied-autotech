import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { invoiceForbidden } from "./billing.errors.js";
export function assertInvoiceCustomer(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") throw invoiceForbidden();
}
export function assertInvoiceOperator(actor: AuthenticatedActor): void {
  if (
    (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") ||
    actor.mfaVerifiedAt === null
  )
    throw invoiceForbidden();
}
