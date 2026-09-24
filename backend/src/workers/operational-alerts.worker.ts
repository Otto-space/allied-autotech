import { prisma } from "../config/database.js";
import { enqueueNotification } from "../modules/notifications/notifications.service.js";
import { currentPolicy } from "../modules/policies/policies.service.js";
import {
  addBusinessMinutes,
  type BusinessCalendar,
} from "../modules/support/business-calendar.js";
import { requestFreeCancellationRefund } from "../modules/payments/refund-workflow.js";

export class OperationalAlertsWorker {
  constructor(private readonly database = prisma) {}
  async runOnce() {
    const cancelledPaid = await this.database.order.findMany({
      where: {
        status: "CANCELLED",
        confirmedAt: null,
        paidAt: { not: null },
        payments: {
          some: { attempts: { some: { status: "SUCCESSFUL", refunds: { none: {} } } } },
        },
      },
      select: { id: true, customer: { select: { userId: true } } },
      take: 100,
    });
    for (const order of cancelledPaid)
      await this.database.$transaction((tx) =>
        requestFreeCancellationRefund(tx, order.id, order.customer.userId),
      );
    const disputes = await this.database.paymentDispute.findMany({
      where: { resolvedAt: null },
      orderBy: { openedAt: "asc" },
      take: 100,
    });
    const disputePolicy = await currentPolicy(this.database, "disputes");
    const settings = disputePolicy.settings as Record<string, unknown>;
    for (const dispute of disputes) {
      if (disputePolicy.approvalStatus === "APPROVED" && !dispute.acknowledgementDueAt) {
        const calendar = settings as unknown as BusinessCalendar;
        const start = addBusinessMinutes(dispute.openedAt, 0, calendar);
        const localDay = new Date(start.getTime() + 3_600_000).toISOString().slice(0, 10);
        const dueAt = new Date(
          new Date(`${localDay}T00:00:00+01:00`).getTime() +
            calendar.closeMinute * 60_000,
        );
        await this.database.paymentDispute.update({
          where: { id: dispute.id },
          data: {
            acknowledgementDueAt: dueAt,
            ...(dispute.primaryUserId
              ? {}
              : {
                  primaryUserId: String(settings["primaryUserId"]),
                  backupUserId: String(settings["backupUserId"]),
                }),
          },
        });
      }
      const needsAction =
        !dispute.primaryUserId ||
        !dispute.backupUserId ||
        !dispute.responseDueAt ||
        (!dispute.acknowledgedAt &&
          (!dispute.acknowledgementDueAt ||
            dispute.acknowledgementDueAt <= new Date())) ||
        (!dispute.respondedAt &&
          dispute.responseDueAt <= new Date(Date.now() + 86_400_000));
      if (needsAction) {
        await this.database.operationalAlert.upsert({
          where: { key: `dispute:${dispute.id}` },
          update: { resolvedAt: null },
          create: {
            key: `dispute:${dispute.id}`,
            category: "DISPUTE_ACTION_REQUIRED",
            resourceId: dispute.id,
            message:
              "Dispute requires assignment, working-day acknowledgement or provider-deadline evidence review. Missing provider deadline/calendar must be verified in the provider dashboard; no deadline is inferred.",
          },
        });
        for (const userId of [dispute.primaryUserId, dispute.backupUserId].filter(
          (id): id is string => id !== null,
        )) {
          const user = await this.database.user.findFirst({
            where: {
              id: userId,
              status: "ACTIVE",
              emailVerifiedAt: { not: null },
              role: { not: "CUSTOMER" },
            },
          });
          if (user)
            await this.database.$transaction((tx) =>
              enqueueNotification(tx, {
                userId,
                type: "PAYMENT",
                category: "TRANSACTIONAL",
                title: "Payment dispute requires attention",
                message:
                  "Review acknowledgement, private evidence and the authoritative provider deadline in the dispute queue.",
                resourceType: "PAYMENT",
                resourceId: dispute.id,
                deduplicationKey: `dispute:${dispute.id}:reminder:${new Date().toISOString().slice(0, 10)}:${userId}`,
                channels: ["EMAIL"],
              }),
            );
        }
      }
    }
    const attentionRefunds = await this.database.refund.findMany({
      where: {
        OR: [
          { status: "NEEDS_ATTENTION" },
          {
            status: { in: ["REQUESTED", "APPROVED", "PENDING", "PROCESSING"] },
            dueAt: { lt: new Date() },
          },
          {
            status: { in: ["PENDING", "PROCESSING"] },
            createdAt: { lt: new Date(Date.now() - 86_400_000) },
          },
        ],
      },
      select: { id: true },
      take: 100,
    });
    for (const refund of attentionRefunds)
      await this.database.operationalAlert.upsert({
        where: { key: `refund:${refund.id}` },
        update: { resolvedAt: null },
        create: {
          key: `refund:${refund.id}`,
          category: "REFUND_RECONCILIATION",
          resourceId: refund.id,
          message:
            "Refund needs reconciliation or independent bank evidence checking. Never resubmit an uncertain gateway refund or pay it a second time by bank.",
        },
      });
    const due = await this.database.complaint.findMany({
      where: {
        priority: "URGENT",
        acknowledgedAt: null,
        acknowledgementDueAt: { lte: new Date() },
        escalatedAt: null,
      },
      take: 100,
      orderBy: { acknowledgementDueAt: "asc" },
    });
    for (const complaint of due)
      await this.database.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Complaint" WHERE "id" = ${complaint.id}::uuid FOR UPDATE`;
        const current = await tx.complaint.findUniqueOrThrow({
          where: { id: complaint.id },
        });
        if (current.acknowledgedAt || current.escalatedAt) return;
        const policy = await currentPolicy(tx, "complaints");
        const settings = policy.settings as Record<string, unknown>;
        const userId = settings["escalationUserId"];
        const recipient =
          typeof userId === "string"
            ? await tx.user.findFirst({
                where: {
                  id: userId,
                  role: { in: ["ADMIN", "SUPER_ADMIN"] },
                  status: "ACTIVE",
                  emailVerifiedAt: { not: null },
                },
              })
            : null;
        await tx.operationalAlert.upsert({
          where: { key: `urgent-complaint:${current.id}` },
          update: { resolvedAt: null },
          create: {
            key: `urgent-complaint:${current.id}`,
            category: "URGENT_COMPLAINT_OVERDUE",
            resourceId: current.id,
            message: recipient
              ? "Urgent complaint acknowledgement is overdue; owner/manager notified"
              : "Urgent complaint acknowledgement is overdue. Owner/manager email routing is not configured; manual escalation required.",
          },
        });
        if (recipient)
          await enqueueNotification(tx, {
            userId: recipient.id,
            type: "COMPLAINT",
            category: "TRANSACTIONAL",
            title: "Urgent complaint acknowledgement overdue",
            message:
              "Review the assigned complaint and acknowledge the customer. Acknowledgement does not mark the issue resolved.",
            resourceType: "COMPLAINT",
            resourceId: current.id,
            deduplicationKey: `complaint:${current.id}:urgent-escalation`,
            channels: ["EMAIL"],
          });
        await tx.complaint.update({
          where: { id: current.id },
          data: { escalatedAt: new Date() },
        });
      });
    const stuck = await this.database.payment.findMany({
      where: {
        status: { in: ["REQUIRES_REVIEW", "PROCESSING"] },
        createdAt: { lt: new Date(Date.now() - 86_400_000) },
      },
      select: { id: true },
      take: 100,
      orderBy: { createdAt: "asc" },
    });
    for (const payment of stuck)
      await this.database.operationalAlert.upsert({
        where: { key: `stuck-payment:${payment.id}` },
        update: { resolvedAt: null },
        create: {
          key: `stuck-payment:${payment.id}`,
          category: "PAYMENT_RECONCILIATION",
          resourceId: payment.id,
          message:
            "Payment has remained in processing/review for over 24 hours. Reconcile provider/bank evidence; do not release protected vehicle allocations or re-charge blindly.",
        },
      });
    const paidHoldPending = await this.database.vehicleTransaction.findMany({
      where: {
        status: { in: ["PARTIALLY_PAID", "PAID", "HANDOVER_PENDING"] },
        paidHoldStartsAt: null,
      },
      select: { id: true },
      take: 100,
    });
    for (const vehicle of paidHoldPending)
      await this.database.operationalAlert.upsert({
        where: { key: `vehicle-hold:${vehicle.id}` },
        update: { resolvedAt: null },
        create: {
          key: `vehicle-hold:${vehicle.id}`,
          category: "VEHICLE_HOLD_POLICY_PENDING",
          resourceId: vehicle.id,
          message:
            "Paid vehicle allocation remains protected. Paid-hold anchor, delayed-confirmation handling and expiry disposition require approved policy; no automatic forfeiture or reassignment.",
        },
      });
    // Close derived alerts only when their underlying recorded condition is resolved.
    await this.database.$executeRaw`
      UPDATE "OperationalAlert" a SET "resolvedAt" = CURRENT_TIMESTAMP
      WHERE a."resolvedAt" IS NULL AND (
        (a."category" = 'URGENT_COMPLAINT_OVERDUE' AND EXISTS (SELECT 1 FROM "Complaint" c WHERE c."id" = a."resourceId" AND c."acknowledgedAt" IS NOT NULL))
        OR (a."category" = 'REFUND_RECONCILIATION' AND EXISTS (SELECT 1 FROM "Refund" r WHERE r."id" = a."resourceId" AND r."status" IN ('SUCCEEDED','CANCELLED')))
        OR (a."category" = 'DISPUTE_ACTION_REQUIRED' AND EXISTS (SELECT 1 FROM "PaymentDispute" d WHERE d."id" = a."resourceId" AND d."resolvedAt" IS NOT NULL))
        OR (a."category" = 'PAYMENT_RECONCILIATION' AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."id" = a."resourceId" AND p."status" NOT IN ('REQUIRES_REVIEW','PROCESSING')))
        OR (a."category" = 'VEHICLE_HOLD_POLICY_PENDING' AND EXISTS (SELECT 1 FROM "VehicleTransaction" v WHERE v."id" = a."resourceId" AND (v."paidHoldStartsAt" IS NOT NULL OR v."status" NOT IN ('PARTIALLY_PAID','PAID','HANDOVER_PENDING'))))
      )`;
    await this.database.rateLimitBucket.deleteMany({
      where: { resetAt: { lt: new Date(Date.now() - 86_400_000) } },
    });
    return { escalated: due.length, stuckPayments: stuck.length };
  }
}
