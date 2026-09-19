import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { paymentForbidden } from "./payments.errors.js";

export function assertPaymentCustomer(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") throw paymentForbidden();
}
export function assertPaymentOperator(actor: AuthenticatedActor): void {
  if (
    (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") ||
    actor.mfaVerifiedAt === null
  )
    throw paymentForbidden();
}
export function assertPaymentApprover(actor: AuthenticatedActor): void {
  if (
    !(["ADMIN", "SUPER_ADMIN"] as const).includes(
      actor.role as "ADMIN" | "SUPER_ADMIN",
    ) ||
    actor.mfaVerifiedAt === null
  )
    throw paymentForbidden();
}
