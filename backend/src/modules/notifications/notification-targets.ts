import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  bookingScope,
  branchesFor,
  workforceSnapshot,
} from "../organization/workforce.policy.js";
import { enquiryScope } from "../organization/workforce-enquiry-scope.js";
import { complaintScope } from "../organization/workforce-care-scope.js";
import { financeScope } from "../organization/workforce-finance-workspace.js";
import { ManualRefundsService } from "../payments/manual-refunds.service.js";

export type NotificationTarget = { section: string; href: string; label: string };
export type TargetReference = {
  id: string;
  resourceType: string | null;
  resourceId: string | null;
  supportMessageId: string | null;
  category?: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolve only known routes. A notification is never itself an authorization grant.
// Lookups are batched by resource kind, not performed once per notification.
export async function resolveNotificationTargets(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  references: readonly TargetReference[],
): Promise<Map<string, NotificationTarget>> {
  const targets = new Map<string, NotificationTarget>();
  if (!references.length) return targets;
  const customer = actor.role === "CUSTOMER";
  const access = customer ? null : await workforceSnapshot(tx, actor);
  const managed = actor.role !== "SUPER_ADMIN" && access?.managed;
  const administrator = actor.role === "ADMIN" || actor.role === "SUPER_ADMIN";
  const staff =
    !customer && !managed && !administrator
      ? await tx.staffProfile.findUnique({
          where: { userId: actor.userId },
          select: { branchId: true, branch: { select: { isActive: true } } },
        })
      : null;
  const branchId = staff?.branch?.isActive ? staff.branchId : null;
  const own = { customer: { userId: actor.userId } };
  const legacyBranch = administrator
    ? {}
    : { branchId: branchId ?? "00000000-0000-0000-0000-000000000000" };
  for (const item of references) {
    if (!item.resourceType && !item.resourceId && item.category === "SECURITY") {
      const section = customer ? "/dashboard/security" : "/admin/security";
      targets.set(item.id, { section, href: section, label: "Review account security" });
    }
  }
  const kinds = [...new Set(references.map((r) => r.resourceType?.toUpperCase()))];
  for (const kind of kinds) {
    const selected = references.filter(
      (r) => r.resourceType?.toUpperCase() === kind && uuid.test(r.resourceId ?? ""),
    );
    const ids = [...new Set(selected.map((r) => r.resourceId!))];
    if (!ids.length) continue;
    let section: string | undefined, path: string | undefined;
    const allowed = new Set<string>();
    for (let offset = 0; offset < ids.length; offset += 500) {
      const identity = { id: { in: ids.slice(offset, offset + 500) } };
      let rows: { id: string }[] = [];
      switch (kind) {
        case "BOOKING":
        case "WORKFORCE_JOB": {
          if (customer && kind !== "BOOKING") break;
          const action = kind === "WORKFORCE_JOB" ? "JOBS_READ" : "BOOKINGS_READ";
          if (managed && !access!.permissions.includes(action)) break;
          section = customer
            ? "/dashboard/bookings"
            : managed
              ? `/admin/workforce/${kind === "WORKFORCE_JOB" ? "jobs" : "bookings"}`
              : "/admin/bookings";
          path = `${section}/`;
          rows = await tx.booking.findMany({
            where: {
              AND: [
                identity,
                customer ? own : managed ? bookingScope(access!, action) : legacyBranch,
              ],
            },
            select: { id: true },
          });
          break;
        }
        case "ORDER":
          section = customer
            ? "/dashboard/orders"
            : managed
              ? "/admin/workforce/orders"
              : "/admin/orders";
          path = managed ? `${section}?selected=` : `${section}/`;
          rows = await tx.order.findMany({
            where: {
              AND: [
                identity,
                customer
                  ? own
                  : managed
                    ? { branchId: { in: branchesFor(access!, "ORDERS_READ") } }
                    : legacyBranch,
              ],
            },
            select: { id: true },
          });
          break;
        case "ENQUIRY":
        case "COMPLAINT": {
          const enquiries = kind === "ENQUIRY";
          const suffix = enquiries ? "enquiries" : "complaints";
          section = customer
            ? "/dashboard/support"
            : managed
              ? `/admin/workforce/${suffix}`
              : "/admin/support";
          path = managed ? `${section}?selected=` : `${section}/${suffix}/`;
          if (
            managed &&
            !(enquiries
              ? access!.permissions.some((p) =>
                  ["CUSTOMER_ENQUIRIES", "SALES_ENQUIRIES", "CARE_CASE_VIEW"].includes(p),
                )
              : access!.permissions.some((p) =>
                  ["COMPLAINTS", "CARE_CASE_VIEW"].includes(p),
                ))
          )
            break;
          rows = enquiries
            ? await tx.enquiry.findMany({
                where: {
                  AND: [
                    identity,
                    customer ? own : managed ? enquiryScope(access!) : legacyBranch,
                  ],
                },
                select: { id: true },
              })
            : await tx.complaint.findMany({
                where: {
                  AND: [
                    identity,
                    customer ? own : managed ? complaintScope(access!) : legacyBranch,
                  ],
                },
                select: { id: true },
              });
          break;
        }
        case "PAYMENT":
          if (!customer && !managed && !administrator) break;
          section = customer
            ? "/dashboard/payments"
            : managed
              ? "/admin/workforce/finance"
              : "/admin/payments";
          path = customer ? `${section}/` : `${section}?selected=`;
          rows = await tx.payment.findMany({
            where: {
              AND: [
                identity,
                customer
                  ? own
                  : managed
                    ? financeScope(branchesFor(access!, "FINANCE_READ"))
                    : {},
              ],
            },
            select: { id: true },
          });
          break;
        case "INVOICE":
          if (managed || (!customer && !administrator)) break;
          section = customer ? "/dashboard/invoices" : "/admin/invoices";
          path = `${section}/`;
          rows = await tx.invoice.findMany({
            where: { AND: [identity, customer ? own : {}] },
            select: { id: true },
          });
          break;
        case "VEHICLE_TRANSACTION":
          if (managed) break;
          section = customer ? "/dashboard/vehicle-transactions" : "/admin/vehicle-sales";
          path = `${section}/`;
          rows = await tx.vehicleTransaction.findMany({
            where: {
              AND: [
                identity,
                customer ? own : administrator ? {} : { vehicleListing: legacyBranch },
              ],
            },
            select: { id: true },
          });
          break;
        case "REVIEW":
          if (!customer) break; // Moderation is a queue, not an exact record view.
          section = "/dashboard/reviews";
          path = `${section}/`;
          rows = await tx.review.findMany({
            where: { ...identity, ...own },
            select: { id: true },
          });
          break;
        case "REFUND": {
          if (customer) break;
          let scope: Prisma.RefundWhereInput;
          try {
            scope = await new ManualRefundsService().scope(tx, actor, true);
          } catch (error) {
            if ((error as { statusCode?: number }).statusCode === 403) break;
            throw error;
          }
          section = "/admin/refunds";
          path = `${section}?refundId=`;
          rows = await tx.refund.findMany({
            where: { AND: [identity, scope] },
            select: { id: true },
          });
          break;
        }
        case "DISPUTE": {
          if (customer) break;
          const grant = await tx.userCapability.findFirst({
            where: {
              userId: actor.userId,
              capability: "DISPUTE_MANAGE",
              revokedAt: null,
            },
            select: { id: true },
          });
          if (!grant) break;
          section =
            administrator && !managed
              ? "/admin/payment-disputes"
              : "/admin/payment-disputes/work";
          path = "/admin/payment-disputes/work?selected=";
          rows = await tx.paymentDispute.findMany({
            where: {
              AND: [
                identity,
                administrator
                  ? {}
                  : {
                      OR: [
                        { primaryUserId: actor.userId },
                        { backupUserId: actor.userId },
                      ],
                    },
              ],
            },
            select: { id: true },
          });
          break;
        }
      }
      for (const row of rows) allowed.add(row.id);
    }
    if (!section || !path) continue;
    const messageIds = [
      ...new Set(
        selected
          .filter((r) => r.supportMessageId && allowed.has(r.resourceId!))
          .map((r) => r.supportMessageId!),
      ),
    ];
    const visibleMessages = new Map<string, string | null>();
    for (let offset = 0; offset < messageIds.length; offset += 500) {
      const messages = await tx.supportMessage.findMany({
        where: {
          id: { in: messageIds.slice(offset, offset + 500) },
          ...(customer || managed
            ? { visibility: "CUSTOMER" as const, kind: { not: "INTERNAL_NOTE" as const } }
            : {}),
        },
        select: { id: true, enquiryId: true, complaintId: true },
      });
      for (const message of messages)
        visibleMessages.set(
          message.id,
          kind === "ENQUIRY" ? message.enquiryId : message.complaintId,
        );
    }
    for (const item of selected) {
      if (!allowed.has(item.resourceId!)) continue;
      if (
        item.supportMessageId &&
        visibleMessages.get(item.supportMessageId) !== item.resourceId
      )
        continue;
      let href = `${path}${item.resourceId}`;
      if (item.supportMessageId)
        href += `${href.includes("?") ? "&" : "?"}messageId=${item.supportMessageId}#support-entry-${item.supportMessageId}`;
      targets.set(item.id, { section, href, label: "View update" });
    }
  }
  return targets;
}
