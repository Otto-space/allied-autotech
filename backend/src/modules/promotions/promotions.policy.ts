import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { promotionForbidden } from "./promotions.errors.js";
export function assertPromotionCustomer(actor: AuthenticatedActor): void {
  if (actor.role !== "CUSTOMER") throw promotionForbidden();
}
export function assertPromotionAdministrator(actor: AuthenticatedActor): void {
  if (
    (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") ||
    actor.mfaVerifiedAt === null
  )
    throw promotionForbidden();
}
