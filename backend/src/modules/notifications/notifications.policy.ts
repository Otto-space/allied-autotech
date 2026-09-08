import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { notificationForbidden } from "./notifications.errors.js";

export function assertNotificationActor(actor: AuthenticatedActor): void {
  if (!(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const).includes(actor.role))
    throw notificationForbidden();
  if (actor.role !== "CUSTOMER" && actor.mfaVerifiedAt === null)
    throw notificationForbidden();
}
