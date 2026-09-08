import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { supportForbidden } from "./support.errors.js";

export function assertSupportCustomer(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") throw supportForbidden();
}

export function assertSupportOperator(actor: AuthenticatedActor): void {
  if (actor.role === "CUSTOMER" || actor.mfaVerifiedAt === null) throw supportForbidden();
}

export function assertReviewModerator(actor: AuthenticatedActor): void {
  if (
    !(["ADMIN", "SUPER_ADMIN"] as const).includes(
      actor.role as "ADMIN" | "SUPER_ADMIN",
    ) ||
    actor.mfaVerifiedAt === null
  )
    throw supportForbidden();
}
