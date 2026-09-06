import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { orderForbidden } from "./orders.errors.js";

export function assertCustomer(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") throw orderForbidden();
}
export function assertOrderOperator(actor: AuthenticatedActor): void {
  if (actor.role === "CUSTOMER" || actor.mfaVerifiedAt === null) throw orderForbidden();
}
