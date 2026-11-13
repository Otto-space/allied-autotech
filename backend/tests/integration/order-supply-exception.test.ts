import { RefundWorker } from "../../src/workers/refund.worker.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import { databaseClock } from "../../src/common/database/clock.js";
import { assertNoSupplyExceptionHold } from "../../src/modules/orders/order-supply-exception-hold.js";
import { Prisma, type PrismaClient } from "../../src/generated/prisma/client.js";
import { OrderPickupService } from "../../src/modules/orders/order-pickup.service.js";
import { currentSupplyResolution } from "../../src/modules/orders/order-supply-resolution.js";
import { vi } from "vitest";
import { readSupplyRefundSettlement } from "../../src/modules/orders/order-supply-refund-settlement.js";
import { ManualRefundsService } from "../../src/modules/payments/manual-refunds.service.js";
import { objectStorage } from "../../src/providers/storage/s3-object-storage.adapter.js";
import { issuePaymentEvidenceTicket } from "../../src/common/security/payment-evidence-tickets.js";
import { PartsQuotesService } from "../../src/modules/orders/parts-quotes.service.js";
import { z } from "zod";
import { refundQueueRecordSchema } from "../../src/modules/payments/refund-record.js";
import { enqueueLateOrderRefund } from "../../src/modules/payments/refund-workflow.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { testCapability } from "../helpers/owner-policy.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import {
  purchaseCookieName,
  sessionCookieName,
} from "../../src/common/security/cookies.js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { createApp } from "../../src/app.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { OrderSupplyExceptionService } from "../../src/modules/orders/order-supply-exception.service.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { assertReviewedPurchasePayable } from "../../src/modules/orders/purchase-review-payable.js";
import { createOrderMoneyAllocation } from "../../src/modules/orders/order-money-allocation.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { testOwner } from "../helpers/owner.js";
import { paymentTestSession } from "../helpers/payment-session.js";
import { reviewSourceCustomer } from "../helpers/review-sources.js";
import { purchaseGuest } from "../helpers/purchase-guest.js";
const context = {
  requestId: "synthetic-supply-exception",
  ipAddress: null,
  userAgent: null,
};
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "isolated order supply concern intake",
  () => {
    beforeAll(assertIsolatedLoopbackDatabase);
    afterAll(() => prisma.$disconnect());
    async function fixture(
      guest = false,
      terms: {
        legacy?: boolean;
        deliveryFeeKobo?: bigint;
        latePayment?: boolean;
        initialStatus?: "PENDING" | "CONFIRMED";
      } = {},
    ) {
      const suffix = randomUUID(),
        owner = await testOwner("unusable-supply-fixture"),
        buyer = await reviewSourceCustomer(),
        access = guest ? await purchaseGuest() : null;
      const actor: AuthenticatedActor = {
        userId: owner.id,
        email: owner.email,
        role: owner.role,
        sessionId: await paymentTestSession(owner.id, owner.role),
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const customerActor: AuthenticatedActor = {
        userId: buyer.user.id,
        email: buyer.user.email,
        role: "CUSTOMER",
        sessionId: await paymentTestSession(buyer.user.id),
        mfaRequired: false,
        mfaVerifiedAt: null,
      };
      const branch = await prisma.branch.create({
        data: {
          code: suffix.slice(0, 10),
          name: "Synthetic supply branch",
          address: "Isolated fixture",
          city: "Lagos",
          state: "Lagos",
        },
      });
      const category = await prisma.category.create({
        data: { name: "Synthetic supply parts", slug: suffix },
      });
      const product = await prisma.product.create({
        data: {
          name: "Synthetic ordered part",
          slug: suffix,
          sku: suffix,
          categoryId: category.id,
          priceKobo: 101n,
        },
      });
      const item = {
        id: randomUUID(),
        quantity: 3,
        unitPriceKobo: 101n,
        subtotalKobo: 303n,
      };
      const order = await prisma.order.create({
        data: {
          customerId: access ? null : buyer.customerId,
          guestId: access?.access.guestId ?? null,
          branchId: branch.id,
          orderNumber: suffix,
          customerName: "Synthetic actual buyer",
          customerEmail: access?.access.email ?? buyer.user.email,
          customerPhone: "08030000000",
          ...(terms.initialStatus === "CONFIRMED"
            ? {
                status: "CONFIRMED" as const,
                confirmedAt: await prisma.$transaction((tx) => databaseClock(tx)),
              }
            : {}),
          subtotalKobo: 303n,
          discountAmountKobo: 5n,
          taxKobo: 22n,
          totalKobo: 320n + (terms.deliveryFeeKobo ?? 0n),
          deliveryFeeKobo: terms.deliveryFeeKobo ?? 0n,
          ...(terms.deliveryFeeKobo
            ? {
                fulfillmentMethod: "DELIVERY",
                deliveryAddress: "Synthetic historical delivery only",
                deliveryName: "Synthetic recipient",
                deliveryPhone: "08030000000",
                deliveryCity: "Port Harcourt",
                deliveryState: "Rivers",
                deliveryCountry: "Nigeria",
              }
            : {}),
          ...(terms.latePayment ? { paymentDueAt: new Date(Date.now() - 60_000) } : {}),
          policySnapshot: terms.legacy
            ? {}
            : {
                monetaryAllocation: createOrderMoneyAllocation([item], 5n, 22n),
              },
          items: {
            create: {
              ...item,
              productId: product.id,
              productName: product.name,
              sku: product.sku,
            },
          },
        },
        include: { items: true },
      });
      const body = {
        expectedVersion: 0,
        idempotencyKey: randomUUID(),
        kind: "UNAVAILABLE",
        affectedLines: [{ orderItemId: item.id, offset: 0, quantity: 1 }],
        customerNote:
          "The original item cannot currently be supplied. Care will review the next step with you.",
        reason: "Private verified supplier conversation in an isolated fixture",
        actualConcernConfirmed: true,
      };
      const service = new OrderSupplyExceptionService();
      const principal = access
        ? { kind: "guest" as const, sessionToken: access.sessionToken }
        : { kind: "account" as const, actor: customerActor };
      return {
        actor,
        customerActor,
        buyer,
        branch,
        order,
        body,
        service,
        principal,
        access,
      };
    }
    async function captured(
      f: Awaited<ReturnType<typeof fixture>>,
      amountKobo = 320n,
      provider: "MANUAL" | "PAYSTACK" = "MANUAL",
    ) {
      // Real isolated database rows for a synthetic capture, not provider acceptance.
      const payment = await prisma.payment.create({
        data: {
          orderId: f.order.id,
          customerId: f.order.customerId,
          paymentNumber: randomUUID(),
          purpose: "ORDER_PAYMENT",
          amountKobo,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
        },
      });
      const capturedAt = await prisma.$transaction((tx) => databaseClock(tx));
      return prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 1,
          internalReference: randomUUID(),
          provider,
          ...(provider === "PAYSTACK"
            ? {
                providerReference: `synthetic-${randomUUID()}`,
                gatewayTransactionId: `synthetic-${randomUUID()}`,
              }
            : {}),
          amountKobo,
          status: "SUCCESSFUL",
          verificationStatus: "VERIFIED",
          verifiedAmountKobo: amountKobo,
          verifiedCurrency: "NGN",
          paidAt: capturedAt,
          verifiedAt: capturedAt,
          createdAt: new Date(Date.now() - 1000),
          initiatedAt: new Date(Date.now() - 1000),
        },
      });
    }
    async function approveManualRefundFixture(actor: AuthenticatedActor) {
      const prior = await prisma.businessPolicyVersion.findFirst({
        where: { key: "manual-refund" },
        orderBy: { version: "desc" },
      });
      await prisma.businessPolicyVersion.create({
        data: {
          key: "manual-refund",
          version: (prior?.version ?? 0) + 1,
          approvalStatus: "APPROVED",
          approvedByUserId: actor.userId,
          source: "Synthetic isolated refund fixture; not production owner approval",
          sourceQuestion: "D17 fixture only",
          effectiveAt: new Date(Date.now() - 1000),
          settings: {},
        },
      });
    }
    async function refundFixture(
      offset = 0,
      quantity = 1,
      initialStatus: "PENDING" | "CONFIRMED" = "PENDING",
    ) {
      const f = await fixture(false, { initialStatus });
      f.body.affectedLines[0]!.offset = offset;
      f.body.affectedLines[0]!.quantity = quantity;
      await approveManualRefundFixture(f.actor);
      const concern = (await f.service.raise(f.actor, f.order.id, f.body, context))
        .items[0]!;
      const chosen = await f.service.choose(
        f.principal,
        f.order.id,
        choiceInput(concern.id),
        context,
      );
      const choice = chosen.items[0]!.supplyRemedyChoices[0]!;
      const attempt = await captured(f);
      const payments = new PaymentsService();
      const body = {
        paymentAttemptId: attempt.id,
        amountKobo: BigInt(
          z
            .object({ amounts: z.object({ totalKobo: z.string() }) })
            .parse(concern.monetaryBasis).amounts.totalKobo,
        ),
        supplyRemedyChoiceId: choice.id,
        reason: "Actual affected original unit including its saved discount and tax",
      };
      return { ...f, concern, choice, attempt, payments, refundBody: body };
    }
    const refundReceipt = (value: unknown) =>
      z
        .object({ refund: refundQueueRecordSchema, replayed: z.boolean() })
        .parse(JSON.parse(JSON.stringify(value)));
    async function independentApprover(capability = "REFUND_APPROVE") {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-approver",
          role: "ADMIN",
          emailVerifiedAt: new Date(),
          staffProfile: {
            create: { firstName: "Synthetic", lastName: "Independent approver" },
          },
        },
      });
      await testCapability(user.id, capability);
      return {
        userId: user.id,
        email: user.email,
        role: "ADMIN" as const,
        sessionId: await paymentTestSession(user.id, "ADMIN"),
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
    }
    async function completeOriginalReceipt(
      f: Awaited<ReturnType<typeof fixture>>,
      attempt: Awaited<ReturnType<typeof captured>>,
    ) {
      const existing = await prisma.payment.findUniqueOrThrow({
        where: { id: attempt.paymentId },
      });
      if (existing.status === "SUCCEEDED" && existing.settledAttemptId === attempt.id)
        return;
      // Complete canonical synthetic manual receipt evidence. This fixture record
      // is isolated test data, not real approval or provider/bank acceptance.
      const receiptReviewer = await independentApprover();
      const recordedAt = await prisma.$transaction((tx) => databaseClock(tx));
      await prisma.manualPaymentReview.create({
        data: {
          paymentAttemptId: attempt.id,
          submittedByUserId: f.customerActor.userId,
          reviewedByUserId: receiptReviewer.userId,
          status: "APPROVED",
          reviewedAt: recordedAt,
          reviewerNote: "Synthetic independently reviewed original manual receipt",
        },
      });
      await prisma.payment.update({
        where: { id: attempt.paymentId },
        data: {
          status: "SUCCEEDED",
          settledAttemptId: attempt.id,
          succeededAt: recordedAt,
        },
      });
      await prisma.order.update({
        where: { id: f.order.id },
        data: { paidAt: attempt.paidAt },
      });
    }
    async function settleOriginal(
      f: Awaited<ReturnType<typeof refundFixture>>,
      beforeResolution?: () => Promise<void>,
    ) {
      const saved = refundReceipt(
        await f.payments.requestRefund(f.actor, f.refundBody, randomUUID(), context),
      );
      await finishActualManualRefund(saved.refund.id);
      if (beforeResolution) await beforeResolution();
      await f.service.resolve(
        f.actor,
        f.order.id,
        {
          expectedVersion: (
            await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })
          ).version,
          idempotencyKey: randomUUID(),
          supplyExceptionId: f.concern.id,
          reason: "Synthetic actual original settlement and physical history reviewed",
          settlementAndPhysicalHistoryReviewed: true,
        },
        context,
      );
      await completeOriginalReceipt(f, f.attempt);
      return saved;
    }
    const choiceInput = (supplyExceptionId: string, expectedVersion = 1) => ({
      expectedVersion,
      supplyExceptionId,
      idempotencyKey: randomUUID(),
      choice: "REFUND_REVIEW",
      statementVersion: "SUPPLY_CHOICE_20261110_V1",
      choiceConfirmed: true,
      customerNote: "Please review the affected original portion for a refund.",
    });
    async function finishActualManualRefund(refundId: string) {
      await new PaymentsService().decideRefund(
        await independentApprover(),
        refundId,
        { decision: "APPROVED" },
        context,
      );
      const transfer = await independentApprover("REFUND_TRANSFER"),
        checker = await independentApprover("REFUND_CHECK");
      const ticket = issuePaymentEvidenceTicket({
        actorUserId: transfer.userId,
        paymentId: refundId,
        mimeType: "application/pdf",
        sizeBytes: 1,
        checksumSha256: "a".repeat(64),
      });
      const storage = vi.spyOn(objectStorage, "verifyObject").mockResolvedValue(true);
      try {
        const manual = new ManualRefundsService();
        await manual.recordTransfer(
          transfer,
          refundId,
          {
            bankReference: `synthetic-settled-${randomUUID()}`,
            transferredAt: (
              await prisma.$transaction((tx) => databaseClock(tx))
            ).toISOString(),
            beneficiary: {
              accountName: "Synthetic beneficiary",
              bankName: "Synthetic bank",
              accountNumber: "0000000000",
            },
            evidenceToken: ticket.ticket,
          },
          context,
        );
        await manual.check(
          checker,
          refundId,
          true,
          "Synthetic independent bank and beneficiary evidence checked",
          context,
        );
      } finally {
        storage.mockRestore();
      }
    }
    async function cancelOriginal(f: Awaited<ReturnType<typeof fixture>>) {
      await new OrdersService().customerCancel(
        f.customerActor,
        f.order.id,
        {
          expectedVersion: (
            await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })
          ).version,
          reason: "Synthetic buyer cancels the entire unfulfilled original order",
        },
        context,
      );
    }
    const cancelledReview = (expectedVersion: number) => ({
      expectedVersion,
      idempotencyKey: randomUUID(),
      reason: "Synthetic actual cancellation, no goods and financial history reviewed",
      noGoodsOutstandingAndSettlementReviewed: true,
    });
    it("reconciles an actual unpaid cancellation without inventing a refund or collection", async () => {
      const f = await fixture(false, { legacy: true });
      await f.service.raise(f.actor, f.order.id, f.body, context);
      await cancelOriginal(f);
      const original = await prisma.order.findUniqueOrThrow({
        where: { id: f.order.id },
      });
      expect(
        (await f.service.readStaff(f.actor, f.order.id, context))
          .cancelledReconciliationReviewAvailable,
      ).toBe(true);
      const input = cancelledReview(original.version);
      const saved = await f.service.close(f.actor, f.order.id, input, context);
      expect(saved.reconciliations).toHaveLength(1);
      expect(saved.cancelledReconciliationReviewAvailable).toBe(false);
      expect(saved.closures).toEqual([]);
      expect(saved.reconciliations[0]).toMatchObject({
        outcome: "NO_CAPTURE_RECORDED",
        originalKobo: "320",
        capturedKobo: "0",
        refundedKobo: "0",
        cancelledUnits: 3,
      });
      expect((await f.service.close(f.actor, f.order.id, input, context)).replayed).toBe(
        true,
      );
      await expect(
        f.service.close(
          f.actor,
          f.order.id,
          { ...input, reason: "Changed private review note must not replay" },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const current = await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } });
      expect(current).toMatchObject({
        status: "CANCELLED",
        cancelledAt: original.cancelledAt,
        cancellationReason: original.cancellationReason,
        totalKobo: 320n,
        paidAt: null,
        version: original.version + 1,
      });
      await expect(
        f.service.close(
          f.customerActor,
          f.order.id,
          cancelledReview(current.version),
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        f.service.choose(
          f.principal,
          f.order.id,
          choiceInput(saved.items[0]!.id, current.version),
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.refund.count({
          where: { paymentAttempt: { payment: { orderId: f.order.id } } },
        }),
      ).toBe(0);
      expect(
        await prisma.orderPickupHandover.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
      const safe = JSON.stringify(await f.service.read(f.principal, f.order.id));
      for (const secret of [
        input.reason,
        "requestHash",
        "captures",
        "ledgerEntryId",
        "sessionId",
        "financialSnapshot",
      ])
        expect(safe).not.toContain(secret);
      const event = await prisma.orderSupplyClosure.findFirstOrThrow({
        where: { orderId: f.order.id },
      });
      await expect(
        prisma.orderSupplyClosure.update({
          where: { id: event.id },
          data: { reason: "History must remain immutable after review" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.$transaction((tx) => assertNoSupplyExceptionHold(tx, f.order.id)),
      ).rejects.toMatchObject({ statusCode: 409 });
      await prisma.$transaction(
        (tx) =>
          tx.$queryRaw`SELECT aat_assert_order_supply_clearance(${f.order.id}::uuid)::text`,
      );
    });
    it.each(["PENDING", "FAILED", "ABANDONED"] as const)(
      "holds an actual cancelled order with an uncertain %s payment attempt",
      async (status) => {
        const f = await fixture();
        const now = await prisma.$transaction((tx) => databaseClock(tx));
        const payment = await prisma.payment.create({
          data: {
            orderId: f.order.id,
            paymentNumber: randomUUID(),
            purpose: "ORDER_PAYMENT",
            amountKobo: 320n,
            status: "CANCELLED",
            cancelledAt: now,
            idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
          },
        });
        await prisma.paymentAttempt.create({
          data: {
            paymentId: payment.id,
            attemptNumber: 1,
            internalReference: randomUUID(),
            provider: "PAYSTACK",
            amountKobo: 320n,
            status,
            ...(status === "FAILED"
              ? { failedAt: now }
              : status === "ABANDONED"
                ? { abandonedAt: now }
                : {}),
          },
        });
        await f.service.raise(f.actor, f.order.id, f.body, context);
        await cancelOriginal(f);
        expect(
          (await f.service.readStaff(f.actor, f.order.id, context))
            .cancelledReconciliationReviewAvailable,
        ).toBe(false);
        await expect(
          f.service.close(f.actor, f.order.id, cancelledReview(2), context),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(
          await prisma.orderSupplyClosure.count({ where: { orderId: f.order.id } }),
        ).toBe(0);
      },
    );
    it("reconciles the full actual unbound legacy cancellation refund after separate approval and bank checking", async () => {
      const f = await fixture(false, { legacy: true });
      await approveManualRefundFixture(f.actor);
      await f.service.raise(f.actor, f.order.id, f.body, context);
      await cancelOriginal(f);
      const attempt = await captured(f);
      await completeOriginalReceipt(f, attempt);
      await prisma.paymentLedgerEntry.create({
        data: {
          paymentAttemptId: attempt.id,
          sourceKey: `capture:${attempt.id}`,
          type: "CAPTURE",
          direction: "CREDIT",
          amountKobo: 320n,
          occurredAt: attempt.paidAt!,
        },
      });
      await cancelOriginal(f);
      const refund = await prisma.refund.findFirstOrThrow({
        where: { paymentAttemptId: attempt.id },
      });
      expect(refund).toMatchObject({
        status: "REQUESTED",
        supplyRemedyChoiceId: null,
        amountKobo: 320n,
      });
      await expect(
        f.service.close(f.actor, f.order.id, cancelledReview(2), context),
      ).rejects.toMatchObject({ statusCode: 409 });
      await finishActualManualRefund(refund.id);
      const saved = await f.service.close(
        f.actor,
        f.order.id,
        cancelledReview(2),
        context,
      );
      expect(saved.reconciliations[0]).toMatchObject({
        outcome: "CAPTURED_FUNDS_RETURNED",
        capturedKobo: "320",
        refundedKobo: "320",
        originalKobo: "320",
        cancelledUnits: 3,
      });
      expect(
        await prisma.orderSupplyResolution.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
      expect(
        (
          await prisma.orderSupplyException.findFirstOrThrow({
            where: { orderId: f.order.id },
          })
        ).monetaryBasis,
      ).toMatchObject({ status: "HISTORICAL_BREAKDOWN_REVIEW_REQUIRED" });
      await prisma.$transaction(
        (tx) =>
          tx.$queryRaw`SELECT aat_assert_order_supply_clearance(${f.order.id}::uuid)::text`,
      );
      const secondAt = await prisma.$transaction((tx) => databaseClock(tx));
      const duplicate = await prisma.paymentAttempt.create({
        data: {
          paymentId: attempt.paymentId,
          attemptNumber: 2,
          internalReference: randomUUID(),
          provider: "MANUAL",
          amountKobo: 320n,
          status: "SUCCESSFUL",
          verificationStatus: "VERIFIED",
          verifiedAmountKobo: 320n,
          verifiedCurrency: "NGN",
          paidAt: secondAt,
          verifiedAt: secondAt,
        },
      });
      await prisma.paymentLedgerEntry.create({
        data: {
          paymentAttemptId: duplicate.id,
          sourceKey: `capture:${duplicate.id}`,
          type: "CAPTURE",
          direction: "CREDIT",
          amountKobo: 320n,
          occurredAt: secondAt,
        },
      });
      await cancelOriginal(f);
      const duplicateRefund = await prisma.refund.findFirstOrThrow({
        where: { paymentAttemptId: duplicate.id },
      });
      await finishActualManualRefund(duplicateRefund.id);
      // Even returned money cannot silently turn an unreviewed manual capture
      // into verified gross history. Actual receipt selection remains unchanged.
      await expect(
        f.service.close(f.actor, f.order.id, cancelledReview(3), context),
      ).rejects.toMatchObject({ statusCode: 409 });
      const reviewer = await independentApprover();
      await prisma.manualPaymentReview.create({
        data: {
          paymentAttemptId: duplicate.id,
          submittedByUserId: f.customerActor.userId,
          reviewedByUserId: reviewer.userId,
          status: "APPROVED",
          reviewedAt: await prisma.$transaction((tx) => databaseClock(tx)),
          reviewerNote:
            "Synthetic independently reviewed duplicate manual receipt; not provider acceptance",
        },
      });
      const reconciled = await f.service.close(
        f.actor,
        f.order.id,
        cancelledReview(3),
        context,
      );
      expect(reconciled.reconciliations).toHaveLength(2);
      expect(reconciled.reconciliations[0]).toMatchObject({
        originalKobo: "320",
        capturedKobo: "640",
        refundedKobo: "640",
      });
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } }))
          .settledAttemptId,
      ).toBe(attempt.id);
      // Actual later discrepancy invalidates clearance without destroying history.
      await prisma.paymentAnomaly.create({
        data: {
          paymentAttemptId: attempt.id,
          type: "OTHER",
          summary: "Synthetic subsequent bank discrepancy",
        },
      });
      await expect(
        prisma.$transaction(
          (tx) =>
            tx.$queryRaw`SELECT aat_assert_order_supply_clearance(${f.order.id}::uuid)::text`,
        ),
      ).rejects.toThrow();
      expect(
        (await f.service.readStaff(f.actor, f.order.id, context)).reconciliations,
      ).toHaveLength(2);
    });
    async function alternativeFixture(guest = false) {
      const f = await fixture(guest);
      const concern = (await f.service.raise(f.actor, f.order.id, f.body, context))
        .items[0]!;
      const principal = f.access
        ? {
            kind: "guest" as const,
            sessionToken: f.access.sessionToken,
            csrfToken: f.access.csrfToken,
          }
        : f.principal;
      const chosen = await f.service.choose(
        principal,
        f.order.id,
        { ...choiceInput(concern.id), choice: "SUITABLE_ALTERNATIVE_REVIEW" },
        context,
      );
      const choice = chosen.items[0]!.supplyRemedyChoices[0]!;
      const quotes = new PartsQuotesService();
      const input = {
        expectedRevision: 0,
        productId: f.order.items[0]!.productId,
        quantity: 2,
        unitPriceKobo: "200",
        notes:
          "Synthetic suitable alternative; separate original refund, no store credit or money transfer. Actual compatibility review remains required before payment.",
      };
      const key = randomUUID();
      const offered = (await quotes.issue(
        f.actor,
        concern.enquiryId,
        input,
        key,
        context,
      )) as { id: string; revision: number; supplyRemedyChoiceId: string };
      const orders = new OrdersService();
      const accept = () =>
        f.access
          ? orders.guestAcceptQuote(
              { sessionToken: f.access.sessionToken, csrfToken: f.access.csrfToken },
              offered.id,
              {
                revision: offered.revision,
                alternativeAgreementVersion: "SUPPLY_ALTERNATIVE_20261110_V1",
                contact: {
                  name: "Synthetic actual alternative buyer",
                  phone: "08030000000",
                },
              },
              randomUUID(),
              context,
            )
          : orders.checkout(
              f.customerActor,
              { branchId: f.branch.id, fulfillmentMethod: "COLLECTION" },
              randomUUID(),
              context,
              {
                id: offered.id,
                revision: offered.revision,
                alternativeAgreementVersion: "SUPPLY_ALTERNATIVE_20261110_V1",
              },
            );
      return {
        ...f,
        principal,
        concern,
        choice,
        quotes,
        input,
        key,
        offered,
        orders,
        accept,
      };
    }
    it.each([false, true])(
      "binds an actual %s guest alternative to its customer choice and explicit accepted unpaid order",
      async (guest) => {
        const f = await alternativeFixture(guest);
        expect(f.offered.supplyRemedyChoiceId).toBe(f.choice.id);
        expect(
          (
            (await f.quotes.issue(
              f.actor,
              f.concern.enquiryId,
              f.input,
              f.key,
              context,
            )) as { id: string }
          ).id,
        ).toBe(f.offered.id);
        expect(
          (await f.service.read(f.principal, f.order.id)).items[0]!.alternativeAccepted,
        ).toBe(false);
        if (f.access)
          await expect(
            f.orders.guestAcceptQuote(
              { sessionToken: f.access.sessionToken, csrfToken: f.access.csrfToken },
              f.offered.id,
              {
                revision: f.offered.revision,
                contact: { name: "Synthetic actual buyer", phone: "08030000000" },
              },
              randomUUID(),
              context,
            ),
          ).rejects.toMatchObject({ statusCode: 409 });
        else
          await expect(
            f.orders.checkout(
              f.customerActor,
              { branchId: f.branch.id, fulfillmentMethod: "COLLECTION" },
              randomUUID(),
              context,
              { id: f.offered.id, revision: f.offered.revision },
            ),
          ).rejects.toMatchObject({ statusCode: 409 });
        const result = (await f.accept()) as {
          order: { id: string; status: string; totalKobo: string };
          replayed: boolean;
        };
        expect(result.order).toMatchObject({ status: "PENDING", totalKobo: "430" });
        const repeated = (await f.accept()) as typeof result;
        expect(repeated.order.id).toBe(result.order.id);
        expect(repeated.replayed).toBe(true);
        const replacement = await prisma.order.findUniqueOrThrow({
          where: { id: result.order.id },
        });
        expect(replacement.paidAt).toBeNull();
        await expect(
          prisma.order.update({
            where: { id: replacement.id },
            data: { policySnapshot: {} },
          }),
        ).rejects.toThrow();

        expect(replacement.customerId).toBe(f.order.customerId);
        expect(replacement.guestId).toBe(f.order.guestId);
        const summary = await f.service.read(f.principal, f.order.id);
        expect(summary.items[0]!.alternativeAccepted).toBe(true);
        expect(summary.items[0]!.supplyRemedyChoices[0]!.alternatives[0]).toMatchObject({
          id: f.offered.id,
          status: "ACCEPTED",
          orderId: replacement.id,
          totalKobo: "430",
          orderStatus: "PENDING",
        });
        expect(await prisma.payment.count({ where: { orderId: replacement.id } })).toBe(
          0,
        );
        await expect(
          prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, replacement.id)),
        ).rejects.toMatchObject({ statusCode: 409 });
        await expect(
          f.service.choose(
            f.principal,
            f.order.id,
            { ...choiceInput(f.concern.id, 2) },
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
      },
    );
    it("refuses stale, technical or cross-case alternative binding and protects the actual issued product and price", async () => {
      const f = await alternativeFixture();
      const quote = await prisma.partsQuote.findUniqueOrThrow({
        where: { id: f.offered.id },
      });
      for (const change of [
        { totalKobo: 431n },
        { quantity: 3 },
        { enquiryId: randomUUID() },
        { supplyRemedyChoiceId: null },
      ])
        await expect(
          prisma.partsQuote.update({ where: { id: quote.id }, data: change }),
        ).rejects.toThrow();
      await expect(
        prisma.partsQuote.delete({ where: { id: quote.id } }),
      ).rejects.toThrow();
      await expect(
        prisma.partsQuote.update({
          where: { id: f.offered.id },
          data: { status: "ACCEPTED", orderId: f.order.id, decidedAt: new Date() },
        }),
      ).rejects.toThrow(/acceptance proof/);
      const other = await fixture();
      const concern = (
        await other.service.raise(
          other.actor,
          other.order.id,
          { ...other.body, kind: "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE" },
          context,
        )
      ).items[0]!;
      await other.service.choose(
        other.principal,
        other.order.id,
        { ...choiceInput(concern.id), choice: "TECHNICAL_REVIEW" },
        context,
      );
      await expect(
        f.quotes.issue(
          other.actor,
          concern.enquiryId,
          { ...f.input, productId: other.order.items[0]!.productId },
          randomUUID(),
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        prisma.partsQuote.create({
          data: {
            ...quote,
            id: randomUUID(),
            enquiryId: concern.enquiryId,
            idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
            policySnapshot:
              quote.policySnapshot as import("../../src/generated/prisma/client.js").Prisma.InputJsonValue,
          },
        }),
      ).rejects.toThrow(/current customer request/);
      await f.service.choose(
        f.principal,
        f.order.id,
        choiceInput(f.concern.id, 2),
        context,
      );
      await expect(f.accept()).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        f.quotes.issue(
          f.actor,
          f.concern.enquiryId,
          { ...f.input, expectedRevision: 1 },
          randomUUID(),
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("uses independent refund approval only after actual alternative acceptance, and blocks preparing another payment", async () => {
      const f = await alternativeFixture();
      const prior = await prisma.businessPolicyVersion.findFirst({
        where: { key: "manual-refund" },
        orderBy: { version: "desc" },
      });
      await prisma.businessPolicyVersion.create({
        data: {
          key: "manual-refund",
          version: (prior?.version ?? 0) + 1,
          approvalStatus: "APPROVED",
          approvedByUserId: f.actor.userId,
          source:
            "Synthetic isolated alternative refund fixture, not production approval",
          sourceQuestion: "D17 isolated alternative acceptance",
          effectiveAt: new Date(Date.now() - 1000),
          settings: {},
        },
      });
      const attempt = await captured(f),
        payments = new PaymentsService();
      const body = {
        paymentAttemptId: attempt.id,
        supplyRemedyChoiceId: f.choice.id,
        amountKobo: 107n,
        reason:
          "Synthetic exact original affected amount; no transfer, fee or store credit",
      };
      await expect(
        payments.requestRefund(f.actor, body, randomUUID(), context),
      ).rejects.toMatchObject({ statusCode: 409 });
      const accepted = (await f.accept()) as { order: { id: string } };
      const receipt = refundReceipt(
        await payments.requestRefund(f.actor, body, randomUUID(), context),
      );
      expect(receipt.refund).toMatchObject({
        supplyRemedyChoiceId: f.choice.id,
        status: "REQUESTED",
        amountKobo: "107",
      });
      const nextPayment = await prisma.payment.create({
        data: {
          orderId: accepted.order.id,
          customerId: f.order.customerId,
          paymentNumber: randomUUID(),
          purpose: "ORDER_PAYMENT",
          amountKobo: 430n,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
        },
      });
      await expect(
        prisma.paymentAttempt.create({
          data: {
            paymentId: nextPayment.id,
            attemptNumber: 1,
            internalReference: randomUUID(),
            provider: "MANUAL",
            amountKobo: 430n,
            status: "INITIALIZED",
          },
        }),
      ).rejects.toThrow(/original affected goods financial resolution/);
      const observed = await prisma.paymentAttempt.create({
        data: {
          paymentId: nextPayment.id,
          attemptNumber: 1,
          internalReference: randomUUID(),
          provider: "MANUAL",
          amountKobo: 430n,
          status: "SUCCESSFUL",
          verificationStatus: "VERIFIED",
          verifiedAmountKobo: 430n,
          verifiedCurrency: "NGN",
          paidAt: new Date(),
          verifiedAt: new Date(),
        },
      });
      expect(observed.status).toBe("SUCCESSFUL"); // actual synthetic capture must remain recorded
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: accepted.order.id } }))
          .paidAt,
      ).toBeNull();
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, accepted.order.id)),
      ).rejects.toMatchObject({ statusCode: 409 });

      const choice = await prisma.orderSupplyRemedyChoice.findUniqueOrThrow({
        where: { id: f.choice.id },
      });
      await expect(
        prisma.orderSupplyRemedyChoice.create({
          data: {
            ...choice,
            id: randomUUID(),
            orderVersion: 2,
            idempotencyKey: randomUUID(),
            choice: "REFUND_REVIEW",
          },
        }),
      ).rejects.toThrow();
    });
    it("revalidates an accepted alternative against actual no-capture cancellation and later money", async () => {
      const f = await alternativeFixture();
      const accepted = (await f.accept()) as { order: { id: string } };
      await cancelOriginal(f);
      await expect(
        prisma.$transaction((tx) =>
          assertNoSupplyExceptionHold(tx, accepted.order.id, "PAYMENT"),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const current = await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } });
      await f.service.close(
        f.actor,
        f.order.id,
        cancelledReview(current.version),
        context,
      );
      for (const mode of ["PAYMENT", "FULFILMENT"] as const) {
        const clearance = await prisma.$transaction((tx) =>
          assertNoSupplyExceptionHold(tx, accepted.order.id, mode),
        );
        expect(clearance.related).toEqual([{ orderId: f.order.id, resolutionIds: [] }]);
      }
      await prisma.$transaction(
        (tx) =>
          tx.$queryRaw`SELECT aat_assert_related_supply_clearance(${accepted.order.id}::uuid)::text`,
      );
      // Preserve actual late-capture facts; invalidate, never erase, the earlier review.
      await captured(f);
      await expect(
        prisma.$transaction((tx) =>
          assertNoSupplyExceptionHold(tx, accepted.order.id, "PAYMENT"),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        prisma.$transaction(
          (tx) =>
            tx.$queryRaw`SELECT aat_assert_related_supply_clearance(${accepted.order.id}::uuid)::text`,
        ),
      ).rejects.toThrow();
      expect(
        await prisma.orderSupplyClosure.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
    });
    it("allows changing the customer preference after the actual unpaid alternative is cancelled without a committed refund", async () => {
      const f = await alternativeFixture();
      const accepted = (await f.accept()) as { order: { id: string; version: number } };
      await f.orders.customerCancel(
        f.customerActor,
        accepted.order.id,
        {
          expectedVersion: accepted.order.version,
          reason:
            "Synthetic buyer cancelled this unpaid replacement before changing remedy",
        },
        context,
      );
      const updated = await f.service.choose(
        f.principal,
        f.order.id,
        choiceInput(f.concern.id, 2),
        context,
      );
      expect(updated.items[0]!.supplyRemedyChoices[0]!.choice).toBe("REFUND_REVIEW");
      expect(updated.items[0]!.supplyRemedyChoices[1]!.alternatives[0]!.orderStatus).toBe(
        "CANCELLED",
      );
      expect(updated.items[0]!.alternativeAccepted).toBe(false);
      const changed = await f.service.choose(
        f.principal,
        f.order.id,
        { ...choiceInput(f.concern.id, 3), choice: "SUITABLE_ALTERNATIVE_REVIEW" },
        context,
      );
      const revised = (await f.quotes.issue(
        f.actor,
        f.concern.enquiryId,
        { ...f.input, expectedRevision: 1 },
        randomUUID(),
        context,
      )) as { revision: number; supplyRemedyChoiceId: string };
      expect(revised.revision).toBe(2);
      expect(revised.supplyRemedyChoiceId).toBe(
        changed.items[0]!.supplyRemedyChoices[0]!.id,
      );
    });
    it("retains real customer choice and changed-choice history without moving money or releasing the hold", async () => {
      const f = await fixture();
      const concern = (await f.service.raise(f.actor, f.order.id, f.body, context))
        .items[0]!;
      const input = choiceInput(concern.id);
      const saved = await f.service.choose(f.principal, f.order.id, input, context);
      expect(saved.orderVersion).toBe(2);
      expect(saved.items[0]!.supplyRemedyChoices).toHaveLength(1);
      expect(saved.items[0]).toMatchObject({
        financialApproval: false,
        alternativeAccepted: false,
        supplyRemedyChoices: [
          { choice: "REFUND_REVIEW", customerNote: input.customerNote },
        ],
      });
      const replay = await f.service.choose(f.principal, f.order.id, input, context);
      expect(replay.orderVersion).toBe(2);
      expect(replay.items[0]!.supplyRemedyChoices[0]!.id).toBe(
        saved.items[0]!.supplyRemedyChoices[0]!.id,
      );
      await expect(
        f.service.choose(
          f.principal,
          f.order.id,
          { ...input, choice: "SUITABLE_ALTERNATIVE_REVIEW" },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const changed = await f.service.choose(
        f.principal,
        f.order.id,
        {
          ...input,
          expectedVersion: 2,
          idempotencyKey: randomUUID(),
          choice: "SUITABLE_ALTERNATIVE_REVIEW",
        },
        context,
      );
      expect(changed.items[0]!.supplyRemedyChoices.map((row) => row.choice)).toEqual([
        "SUITABLE_ALTERNATIVE_REVIEW",
        "REFUND_REVIEW",
      ]);
      expect(changed.orderVersion).toBe(3);
      const safe = JSON.stringify(changed);
      for (const secret of [
        f.body.reason,
        "customerUserId",
        "guestSessionId",
        "sessionId",
        "requestHash",
        "idempotencyKey",
      ])
        expect(safe).not.toContain(secret);
      const stored = await prisma.orderSupplyRemedyChoice.findFirstOrThrow({
        where: { orderId: f.order.id },
      });
      await expect(
        prisma.orderSupplyRemedyChoice.update({
          where: { id: stored.id },
          data: { choice: "TECHNICAL_REVIEW" },
        }),
      ).rejects.toThrow(/immutable/);
      await expect(
        prisma.orderSupplyRemedyChoice.delete({ where: { id: stored.id } }),
      ).rejects.toThrow(/immutable/);
      expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(0);
      expect(
        await prisma.refund.count({
          where: { paymentAttempt: { payment: { orderId: f.order.id } } },
        }),
      ).toBe(0);
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, f.order.id)),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("serializes distinct customer choices and refuses stale or foreign concerns", async () => {
      const f = await fixture(),
        other = await fixture();
      const concern = (await f.service.raise(f.actor, f.order.id, f.body, context))
        .items[0]!;
      const input = choiceInput(concern.id);
      await expect(
        f.service.choose(other.principal, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        f.service.choose({ kind: "account", actor: f.actor }, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        f.service.choose(
          f.principal,
          f.order.id,
          { ...input, supplyExceptionId: randomUUID() },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      const results = await Promise.allSettled([
        f.service.choose(f.principal, f.order.id, input, context),
        f.service.choose(
          f.principal,
          f.order.id,
          {
            ...input,
            idempotencyKey: randomUUID(),
            choice: "SUITABLE_ALTERNATIVE_REVIEW",
          },
          context,
        ),
      ]);
      expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
      expect(
        await prisma.orderSupplyRemedyChoice.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
      await expect(
        f.service.choose(
          f.principal,
          f.order.id,
          { ...input, idempotencyKey: randomUUID() },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const stored = await prisma.orderSupplyRemedyChoice.findFirstOrThrow({
        where: { orderId: f.order.id },
      });
      await expect(
        prisma.orderSupplyRemedyChoice.create({
          data: {
            ...stored,
            id: randomUUID(),
            orderVersion: 2,
            customerUserId: other.customerActor.userId,
            sessionId: other.customerActor.sessionId,
            idempotencyKey: randomUUID(),
          },
        }),
      ).rejects.toThrow(/actual customer/);
      await prisma.session.update({
        where: { id: f.customerActor.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(
        f.service.choose(f.principal, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
    it("requires current guest proof and CSRF for a choice without borrowing account access", async () => {
      const f = await fixture(true),
        other = await fixture(true);
      const concern = (await f.service.raise(f.actor, f.order.id, f.body, context))
        .items[0]!;
      const input = choiceInput(concern.id);
      await expect(
        f.service.choose(f.principal, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        f.service.choose(
          {
            kind: "guest",
            sessionToken: other.access!.sessionToken,
            csrfToken: other.access!.csrfToken,
          },
          f.order.id,
          input,
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      const principal = { ...f.principal, csrfToken: f.access!.csrfToken };
      const saved = await f.service.choose(principal, f.order.id, input, context);
      expect(saved.items[0]!.supplyRemedyChoices[0]!.choice).toBe("REFUND_REVIEW");
      await prisma.purchaseGuestSession.update({
        where: { id: f.access!.access.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(
        f.service.choose(principal, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 401 });
    });
    it("keeps installed/used/diagnosis choices in technical assessment without a general return entitlement", async () => {
      const f = await fixture();
      const concern = (
        await f.service.raise(
          f.actor,
          f.order.id,
          { ...f.body, kind: "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE" },
          context,
        )
      ).items[0]!;
      const input = choiceInput(concern.id);
      await expect(
        f.service.choose(f.principal, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 409 });
      const saved = await f.service.choose(
        f.principal,
        f.order.id,
        { ...input, choice: "TECHNICAL_REVIEW" },
        context,
      );
      expect(saved.items[0]).toMatchObject({
        monetaryBasis: { amounts: null, feeKobo: null },
        financialApproval: false,
        supplyRemedyChoices: [{ choice: "TECHNICAL_REVIEW" }],
      });
      const stored = await prisma.orderSupplyRemedyChoice.findFirstOrThrow({
        where: { orderId: f.order.id },
      });
      await expect(
        prisma.orderSupplyRemedyChoice.create({
          data: {
            ...stored,
            id: randomUUID(),
            orderVersion: 2,
            choice: "REFUND_REVIEW",
            idempotencyKey: randomUUID(),
          },
        }),
      ).rejects.toThrow(/technical assessment/);
    });
    it("requires account and guest HTTP origin/CSRF, rejects mixed cookies and returns a safe no-store choice receipt", async () => {
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      for (const guest of [false, true]) {
        const f = await fixture(guest);
        const concern = (await f.service.raise(f.actor, f.order.id, f.body, context))
          .items[0]!;
        const input = choiceInput(concern.id);
        const path = `/api/v1/${guest ? "purchase" : "customers"}/orders/${f.order.id}/supply-exceptions/choice`;
        const cookie = guest
          ? `${purchaseCookieName}=${f.access!.sessionToken}`
          : f.buyer.cookie;
        expect(
          (
            await request(app)
              .post(path)
              .set("Cookie", cookie)
              .set("Origin", env.FRONTEND_URL[0]!)
              .set("x-csrf-token", "x".repeat(43))
              .send(input)
          ).status,
        ).toBe(403);
        if (guest)
          expect(
            (
              await request(app)
                .post(path)
                .set("Cookie", `${cookie}; ${f.buyer.cookie}`)
                .set("Origin", env.FRONTEND_URL[0]!)
                .set("x-csrf-token", f.access!.csrfToken)
                .send(input)
            ).status,
          ).toBe(409);
        const result = await request(app)
          .post(path)
          .set("Cookie", cookie)
          .set("Origin", env.FRONTEND_URL[0]!)
          .set("x-csrf-token", guest ? f.access!.csrfToken : f.buyer.csrf)
          .send(input);
        expect(result.status, JSON.stringify(result.body)).toBe(200);
        expect(result.headers["cache-control"]).toContain("no-store");
        expect(result.body.data.items[0].supplyRemedyChoices[0].choice).toBe(
          "REFUND_REVIEW",
        );
        expect(JSON.stringify(result.body)).not.toContain("sessionId");
      }
    });
    it("binds the exact original affected gross to the existing refund request and independent approval", async () => {
      const f = await refundFixture(),
        key = randomUUID();
      const saved = refundReceipt(
        await f.payments.requestRefund(f.actor, f.refundBody, key, context),
      );
      expect(saved.refund).toMatchObject({
        supplyRemedyChoiceId: f.choice.id,
        status: "REQUESTED",
        amountKobo: "107",
      });
      const replay = await f.payments.requestRefund(f.actor, f.refundBody, key, context);
      expect(replay).toMatchObject({ replayed: true, refund: { id: saved.refund.id } });
      await expect(
        f.payments.requestRefund(
          f.actor,
          { ...f.refundBody, supplyRemedyChoiceId: randomUUID() },
          key,
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await testCapability(f.actor.userId, "REFUND_APPROVE");
      await expect(
        f.payments.decideRefund(
          f.actor,
          saved.refund.id,
          { decision: "APPROVED" },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const approved = await f.payments.decideRefund(
        await independentApprover(),
        saved.refund.id,
        { decision: "APPROVED" },
        context,
      );
      expect(approved).toMatchObject({
        status: "NEEDS_ATTENTION",
        providerStatus: "OFFLINE_PROCESSING_REQUIRED",
        processedAt: null,
      });
      const safe = await f.service.read(f.principal, f.order.id);
      expect(safe.items[0]!.supplyRemedyChoices[0]!.refunds[0]).toMatchObject({
        id: saved.refund.id,
        status: "NEEDS_ATTENTION",
        amountKobo: "107",
        processedAt: null,
      });
      for (const secret of [
        "bankReference",
        "beneficiaryEncrypted",
        "policySnapshot",
        "requestedByUserId",
        "sessionId",
      ])
        expect(JSON.stringify(safe)).not.toContain(secret);
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, f.order.id)),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })).totalKobo,
      ).toBe(320n);
    });
    it("preserves actual original refund resolution after the customer cancels the accepted unpaid replacement", async () => {
      const f = await alternativeFixture();
      const accepted = (await f.accept()) as { order: { id: string } };
      const prior = await prisma.businessPolicyVersion.findFirst({
        where: { key: "manual-refund" },
        orderBy: { version: "desc" },
      });
      await prisma.businessPolicyVersion.create({
        data: {
          key: "manual-refund",
          version: (prior?.version ?? 0) + 1,
          approvalStatus: "APPROVED",
          approvedByUserId: f.actor.userId,
          source: "Synthetic isolated independent refund policy fixture",
          sourceQuestion: "D17 historical acceptance verification",
          effectiveAt: new Date(Date.now() - 1000),
          settings: {},
        },
      });
      const attempt = await captured(f),
        payments = new PaymentsService(),
        refundBody = {
          paymentAttemptId: attempt.id,
          supplyRemedyChoiceId: f.choice.id,
          amountKobo: 107n,
          reason: "Synthetic exact affected original portion after actual acceptance",
        };
      await settleOriginal({ ...f, attempt, payments, refundBody }, async () => {
        const current = await prisma.order.findUniqueOrThrow({
          where: { id: accepted.order.id },
        });
        await f.orders.customerCancel(
          f.customerActor,
          accepted.order.id,
          {
            expectedVersion: current.version,
            reason:
              "Synthetic customer cancelled the unpaid replacement after original refund",
          },
          context,
        );
      });
      const resolution = await prisma.$transaction((tx) =>
        currentSupplyResolution(tx, f.order.id, f.concern.id),
      );
      expect(resolution.settlementProof.amountKobo).toBe("107");
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT aat_assert_order_supply_clearance(${f.order.id}::uuid)::text`;
        const scope = await assertNoSupplyExceptionHold(tx, accepted.order.id, "PAYMENT");
        expect(scope.related).toEqual([
          { orderId: f.order.id, resolutionIds: [resolution.resolutionId] },
        ]);
      });
      expect(
        await prisma.order.findUnique({ where: { id: accepted.order.id } }),
      ).toMatchObject({ status: "CANCELLED", paidAt: null });
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, accepted.order.id)),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.payment.count({
          where: { orderId: accepted.order.id, status: "SUCCEEDED" },
        }),
      ).toBe(0);
    });
    it.each(["ACTIVE", "CONSUMED"] as const)(
      "closes fully refunded unfulfilled goods with %s allocations without inventing handover or stock returns",
      async (status) => {
        const f = await refundFixture(
          0,
          3,
          status === "CONSUMED" ? "CONFIRMED" : "PENDING",
        );
        await settleOriginal(f);
        const inventory = await prisma.inventory.create({
          data: {
            branchId: f.branch.id,
            productId: f.order.items[0]!.productId,
            quantity: status === "CONSUMED" ? 7 : 10,
            reserved: status === "ACTIVE" ? 3 : 0,
          },
        });
        const reservation = await prisma.inventoryReservation.create({
          data: {
            inventoryId: inventory.id,
            customerId: f.order.customerId,
            quantity: 3,
            status,
            expiresAt: new Date(Date.now() + 3600000),
            ...(status === "CONSUMED"
              ? { consumedAt: await prisma.$transaction((tx) => databaseClock(tx)) }
              : {}),
            idempotencyKey: randomUUID(),
            requestHash: "a".repeat(64),
            referenceType: "ORDER",
            referenceId: f.order.id,
          },
        });
        const input = {
          expectedVersion: 3,
          idempotencyKey: randomUUID(),
          reason: "Synthetic actual original refunds and no goods outstanding verified",
          noGoodsOutstandingAndSettlementReviewed: true,
        };
        await expect(
          f.service.close(
            { ...f.actor, mfaVerifiedAt: null },
            f.order.id,
            input,
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 403 });
        await expect(
          f.service.close(f.customerActor, f.order.id, input, context),
        ).rejects.toMatchObject({ statusCode: 403 });
        await expect(
          f.service.close(f.actor, f.order.id, { ...input, expectedVersion: 2 }, context),
        ).rejects.toMatchObject({ statusCode: 409 });
        await expect(
          new OrdersService().transition(
            f.actor,
            f.order.id,
            { status: "CANCELLED", expectedVersion: 3, reason: input.reason },
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
        const anomaly = await prisma.paymentAnomaly.create({
          data: {
            paymentAttemptId: f.attempt.id,
            type: "OTHER",
            summary: "Synthetic changed original finance evidence",
          },
        });
        await expect(
          f.service.close(f.actor, f.order.id, input, context),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(
          await prisma.inventoryReservation.findUnique({ where: { id: reservation.id } }),
        ).toMatchObject({ status, quantity: 3 });
        await prisma.paymentAnomaly.update({
          where: { id: anomaly.id },
          data: {
            status: "RESOLVED",
            resolvedAt: await prisma.$transaction((tx) => databaseClock(tx)),
            resolvedByUserId: f.actor.userId,
            resolutionNote: "Synthetic independent discrepancy review completed",
          },
        });
        const current = await f.service.readStaff(f.actor, f.order.id, context);
        expect(current.closureReviewAvailable).toBe(true);
        const corrupt = prisma.$extends({
          query: {
            orderSupplyClosure: {
              create({ args, query }) {
                args.data.financialSnapshot = {
                  version: "ORDER_SUPPLY_CLOSURE_V1",
                  originalKobo: "320",
                  refundedKobo: "310",
                  remainingKobo: "10",
                };
                return query(args);
              },
            },
          },
        }) as unknown as PrismaClient;
        await expect(
          new OrderSupplyExceptionService(corrupt).close(
            f.actor,
            f.order.id,
            input,
            context,
          ),
        ).rejects.toThrow();
        expect(
          await prisma.inventoryReservation.findUnique({ where: { id: reservation.id } }),
        ).toMatchObject({ status, quantity: 3 });
        let closed: unknown;
        if (status === "ACTIVE") {
          const app = createApp({
            checkReadiness: async () => undefined,
            rateLimit: 10000,
          });
          const token = randomUUID(),
            csrf = randomUUID().repeat(2),
            now = await prisma.$transaction((tx) => databaseClock(tx));
          const expiresAt = new Date(now.getTime() + 3600000);
          await prisma.session.create({
            data: {
              userId: f.actor.userId,
              tokenHash: hashToken("session", token),
              csrfTokenHash: hashToken("csrf", csrf),
              createdAt: new Date(now.getTime() - 1000),
              expiresAt,
              idleExpiresAt: expiresAt,
              mfaRequired: true,
              mfaVerifiedAt: now,
            },
          });
          const path = `/api/v1/staff/orders/${f.order.id}/supply-exceptions/close`;
          const headers = {
            Cookie: `${sessionCookieName}=${token}`,
            Origin: env.FRONTEND_URL[0]!,
          };
          expect((await request(app).post(path).set(headers).send(input)).status).toBe(
            403,
          );
          expect(
            (
              await request(app)
                .post(path)
                .set("Cookie", f.buyer.cookie)
                .set("Origin", env.FRONTEND_URL[0]!)
                .set("x-csrf-token", f.buyer.csrf)
                .send(input)
            ).status,
          ).toBe(403);
          expect(
            await prisma.orderSupplyClosure.count({ where: { orderId: f.order.id } }),
          ).toBe(0);
          const response = await request(app)
            .post(path)
            .set(headers)
            .set("x-csrf-token", csrf)
            .send(input);
          expect(response.status, JSON.stringify(response.body)).toBe(200);
          expect(response.headers["cache-control"]).toContain("no-store");
          closed = response.body.data;
        } else closed = await f.service.close(f.actor, f.order.id, input, context);
        expect(closed).toMatchObject({
          orderVersion: 4,
          replayed: false,
          closureReviewAvailable: false,
          closures: [
            {
              resultingStatus: "CANCELLED",
              originalKobo: "320",
              refundedKobo: "320",
              remainingKobo: "0",
              originalUnits: 3,
              refundedUnfulfilledUnits: 3,
              handedUnits: 0,
            },
          ],
        });
        expect(await f.service.close(f.actor, f.order.id, input, context)).toMatchObject({
          orderVersion: 4,
          replayed: true,
        });
        await expect(
          f.service.close(
            f.actor,
            f.order.id,
            { ...input, reason: "Changed private closure review note" },
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(
          await prisma.order.findUnique({ where: { id: f.order.id } }),
        ).toMatchObject({
          status: "CANCELLED",
          totalKobo: 320n,
          subtotalKobo: 303n,
          taxKobo: 22n,
          discountAmountKobo: 5n,
        });
        expect(
          await prisma.inventory.findUnique({ where: { id: inventory.id } }),
        ).toMatchObject({ quantity: status === "CONSUMED" ? 7 : 10, reserved: 0 });
        expect(
          await prisma.inventoryReservation.findUnique({ where: { id: reservation.id } }),
        ).toMatchObject({
          status: status === "ACTIVE" ? "RELEASED" : "CONSUMED",
          quantity: 3,
        });
        expect(
          await prisma.orderPickupHandover.count({ where: { orderId: f.order.id } }),
        ).toBe(0);
        expect(
          await prisma.inventoryTransaction.count({
            where: { referenceId: f.order.id, type: "RESTOCK" },
          }),
        ).toBe(0);
        const safe = JSON.stringify(await f.service.read(f.principal, f.order.id));
        for (const privateValue of [
          input.reason,
          "recordedByUserId",
          "sessionId",
          "requestHash",
          "idempotencyKey",
          "financialSnapshot",
          "financialReviewHash",
          "handoverIds",
          "supplyResolutionIds",
        ])
          expect(safe).not.toContain(privateValue);
        const saved = await prisma.orderSupplyClosure.findFirstOrThrow({
          where: { orderId: f.order.id },
        });
        await expect(
          prisma.orderSupplyClosure.update({
            where: { id: saved.id },
            data: { reason: "Attempted historical rewrite" },
          }),
        ).rejects.toThrow(/immutable/);
        await expect(
          prisma.orderSupplyClosure.delete({ where: { id: saved.id } }),
        ).rejects.toThrow(/immutable/);
        await expect(
          prisma.$transaction(async (tx) =>
            tx.orderSupplyClosure.create({
              data: {
                ...saved,
                financialSnapshot: saved.financialSnapshot as Prisma.InputJsonValue,
                id: randomUUID(),
                orderVersion: 4,
                originalStatus: "CANCELLED",
                idempotencyKey: randomUUID(),
                financialReviewHash: "b".repeat(64),
                createdAt: await databaseClock(tx),
              },
            }),
          ),
        ).rejects.toThrow(/atomically/);
        expect(
          await prisma.orderSupplyClosure.count({ where: { orderId: f.order.id } }),
        ).toBe(1);
      },
    );
    it("financially closes a refunded remainder while preserving the actual earlier partial pickup and consumed stock", async () => {
      const f = await fixture(),
        attempt = await captured(f);
      await approveManualRefundFixture(f.actor);
      await completeOriginalReceipt(f, attempt);
      const item = f.order.items[0]!;
      const inventory = await prisma.inventory.create({
        data: {
          branchId: f.branch.id,
          productId: item.productId,
          quantity: 10,
          reserved: 3,
        },
      });
      await prisma.inventoryReservation.create({
        data: {
          inventoryId: inventory.id,
          customerId: f.order.customerId,
          quantity: 3,
          expiresAt: new Date(Date.now() + 3600000),
          idempotencyKey: randomUUID(),
          requestHash: "a".repeat(64),
          referenceType: "ORDER",
          referenceId: f.order.id,
        },
      });
      const orders = new OrdersService();
      await orders.transition(
        f.actor,
        f.order.id,
        { status: "CONFIRMED", expectedVersion: 0 },
        context,
      );
      await orders.transition(
        f.actor,
        f.order.id,
        { status: "PROCESSING", expectedVersion: 1 },
        context,
      );
      await orders.transition(
        f.actor,
        f.order.id,
        { status: "READY", expectedVersion: 2 },
        context,
      );
      const pickup = new OrderPickupService(),
        buyer = { kind: "account" as const, actor: f.customerActor };
      const lines = [{ orderItemId: item.id, quantity: 1 }];
      const code = await pickup.issue(
        buyer,
        f.order.id,
        { expectedVersion: 3, idempotencyKey: randomUUID(), lines },
        context,
      );
      const current = await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } });
      const preview = await pickup.verify(f.actor, f.order.id, {
        expectedVersion: current.version,
        pickupCode: code.pickupCode!,
        lines,
      });
      const handover = await pickup.handover(
        f.actor,
        f.order.id,
        {
          expectedVersion: preview.version,
          pickupCode: code.pickupCode!,
          claimId: preview.claimId,
          authorisationId: preview.authorisationId,
          financialReviewHash: preview.financialReviewHash,
          idempotencyKey: randomUUID(),
          lines,
          collectorName: "Synthetic actual partial collector",
          verificationNote:
            "Actual eligible original unit handed over after private review",
          physicalHandoverConfirmed: true,
        },
        context,
      );
      expect(handover.complete).toBe(false);
      const afterHandover = await prisma.order.findUniqueOrThrow({
        where: { id: f.order.id },
      });
      const concern = (
        await f.service.raise(
          f.actor,
          f.order.id,
          {
            ...f.body,
            expectedVersion: afterHandover.version,
            affectedLines: [{ orderItemId: item.id, offset: 1, quantity: 2 }],
          },
          context,
        )
      ).items[0]!;
      const chosen = await f.service.choose(
        f.principal,
        f.order.id,
        choiceInput(concern.id, afterHandover.version + 1),
        context,
      );
      const choice = chosen.items[0]!.supplyRemedyChoices[0]!;
      const refundBody = {
        paymentAttemptId: attempt.id,
        amountKobo: BigInt(
          z
            .object({ amounts: z.object({ totalKobo: z.string() }) })
            .parse(concern.monetaryBasis).amounts.totalKobo,
        ),
        supplyRemedyChoiceId: choice.id,
        reason: "Synthetic actual unfulfilled original remainder including saved tax",
      };
      await settleOriginal({
        ...f,
        concern,
        choice,
        attempt,
        payments: new PaymentsService(),
        refundBody,
      });
      const version = (
        await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })
      ).version;
      const closed = await f.service.close(
        f.actor,
        f.order.id,
        {
          expectedVersion: version,
          idempotencyKey: randomUUID(),
          reason:
            "Synthetic actual partial pickup and independently settled remaining refund reviewed",
          noGoodsOutstandingAndSettlementReviewed: true,
        },
        context,
      );
      expect(closed.closures[0]).toMatchObject({
        resultingStatus: "COMPLETED",
        originalUnits: 3,
        handedUnits: 1,
        refundedUnfulfilledUnits: 2,
        originalKobo: "320",
        refundedKobo: refundBody.amountKobo.toString(),
        remainingKobo: (320n - refundBody.amountKobo).toString(),
      });
      expect(await prisma.order.findUnique({ where: { id: f.order.id } })).toMatchObject({
        status: "COMPLETED",
        totalKobo: 320n,
      });
      const actual = await prisma.orderPickupHandover.findMany({
        where: { orderId: f.order.id },
      });
      expect(actual).toHaveLength(1);
      expect(actual[0]).toMatchObject({
        id: handover.id,
        completedOrder: false,
        unitRanges: [{ orderItemId: item.id, offset: 0, quantity: 1 }],
      });
      expect(
        await prisma.inventory.findUnique({ where: { id: inventory.id } }),
      ).toMatchObject({ quantity: 7, reserved: 0 });
      expect(
        await prisma.inventoryTransaction.count({
          where: { referenceId: f.order.id, type: "RESTOCK" },
        }),
      ).toBe(0);
      expect((await pickup.read(buyer, f.order.id)).remaining).toEqual([]);
    });
    it("keeps actual remaining goods open rather than treating a partial refund as financial closure", async () => {
      const f = await refundFixture();
      await settleOriginal(f);
      const input = {
        expectedVersion: 3,
        idempotencyKey: randomUUID(),
        reason: "Synthetic attempted closure while actual original goods are still owed",
        noGoodsOutstandingAndSettlementReviewed: true,
      };
      expect(
        (await f.service.readStaff(f.actor, f.order.id, context)).closureReviewAvailable,
      ).toBe(false);
      await expect(
        f.service.close(f.actor, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.orderSupplyClosure.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
      expect(await prisma.order.findUnique({ where: { id: f.order.id } })).toMatchObject({
        status: "PENDING",
        version: 3,
        totalKobo: 320n,
      });
    });
    it.each([1, 2])(
      "allocates and collects remaining units around a refunded gap, first collecting %i, without repricing or restocking",
      async (firstQuantity) => {
        const f = await refundFixture(1);
        await settleOriginal(f);
        const item = f.order.items[0]!,
          orders = new OrdersService();
        const inventory = await prisma.inventory.create({
          data: {
            branchId: f.branch.id,
            productId: item.productId,
            quantity: 10,
            reserved: 3,
          },
        });
        const held = await prisma.inventoryReservation.create({
          data: {
            inventoryId: inventory.id,
            customerId: f.order.customerId,
            quantity: 3,
            expiresAt: new Date(Date.now() + 3600000),
            idempotencyKey: randomUUID(),
            requestHash: "a".repeat(64),
            referenceType: "ORDER",
            referenceId: f.order.id,
          },
        });
        const anomaly = await prisma.paymentAnomaly.create({
          data: {
            paymentAttemptId: f.attempt.id,
            type: "OTHER",
            summary: "Synthetic current financial discrepancy",
          },
        });
        await expect(
          orders.transition(
            f.actor,
            f.order.id,
            {
              status: "CONFIRMED",
              expectedVersion: 3,
              reason: "Synthetic remaining goods allocation reviewed",
            },
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(
          await prisma.inventory.findUnique({ where: { id: inventory.id } }),
        ).toMatchObject({ quantity: 10, reserved: 3 });
        await prisma.paymentAnomaly.update({
          where: { id: anomaly.id },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            resolvedByUserId: f.actor.userId,
            resolutionNote: "Synthetic actual discrepancy independently reviewed",
          },
        });
        expect(
          (
            (await orders.staffOrder(f.actor, f.order.id, context)) as {
              allowedTransitions: string[];
            }
          ).allowedTransitions,
        ).toContain("CONFIRMED");
        await orders.transition(
          f.actor,
          f.order.id,
          {
            status: "CONFIRMED",
            expectedVersion: 3,
            reason: "Synthetic remaining goods allocation reviewed",
          },
          context,
        );
        expect(
          await prisma.inventory.findUnique({ where: { id: inventory.id } }),
        ).toMatchObject({ quantity: 8, reserved: 0 });
        expect(
          await prisma.inventoryReservation.findUnique({ where: { id: held.id } }),
        ).toMatchObject({ quantity: 3, status: "RELEASED" });
        expect(
          await prisma.inventoryReservation.findMany({
            where: { referenceId: f.order.id, status: "CONSUMED" },
          }),
        ).toMatchObject([{ quantity: 2 }]);
        expect(
          await prisma.inventoryTransaction.count({
            where: { referenceId: f.order.id, type: "RESTOCK" },
          }),
        ).toBe(0);
        await orders.transition(
          f.actor,
          f.order.id,
          { status: "PROCESSING", expectedVersion: 4 },
          context,
        );
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 60000);
        try {
          await orders.transition(
            f.actor,
            f.order.id,
            { status: "READY", expectedVersion: 5 },
            context,
          );
        } finally {
          vi.useRealTimers();
        }
        const pickup = new OrderPickupService(),
          buyer = { kind: "account" as const, actor: f.customerActor };
        const summary = await pickup.read(buyer, f.order.id);
        expect(summary.remaining).toEqual([{ orderItemId: item.id, quantity: 2 }]);
        await expect(
          pickup.issue(
            buyer,
            f.order.id,
            {
              expectedVersion: 6,
              idempotencyKey: randomUUID(),
              lines: [{ orderItemId: item.id, quantity: 3 }],
            },
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
        const selectedLines = [{ orderItemId: item.id, quantity: firstQuantity }];
        const code = await pickup.issue(
          buyer,
          f.order.id,
          { expectedVersion: 6, idempotencyKey: randomUUID(), lines: selectedLines },
          context,
        );
        const preview = await pickup.verify(f.actor, f.order.id, {
          expectedVersion: 7,
          pickupCode: code.pickupCode!,
          lines: selectedLines,
        });
        const handover = {
          expectedVersion: preview.version,
          pickupCode: code.pickupCode!,
          claimId: preview.claimId,
          authorisationId: preview.authorisationId,
          financialReviewHash: preview.financialReviewHash,
          idempotencyKey: randomUUID(),
          lines: selectedLines,
          collectorName: "Synthetic actual collector",
          verificationNote:
            "Actual remaining goods and private authority checked at collection",
          physicalHandoverConfirmed: true,
        };
        for (const corruption of [
          "legacy-null",
          "refunded-unit",
          "stale-financial",
        ] as const) {
          const database = prisma.$extends({
            query: {
              orderPickupHandover: {
                create({ args, query }) {
                  if (corruption === "legacy-null") args.data.unitRanges = Prisma.DbNull;
                  else if (corruption === "refunded-unit")
                    args.data.unitRanges = [
                      { orderItemId: item.id, offset: 1, quantity: 2 },
                    ];
                  else
                    args.data.financialSnapshot = {
                      version: "ORDER_PICKUP_CLEARANCE_V1",
                    };
                  return query(args);
                },
              },
            },
          }) as unknown as PrismaClient;
          await expect(
            new OrderPickupService(database).handover(
              f.actor,
              f.order.id,
              handover,
              context,
            ),
          ).rejects.toThrow();
          expect(
            await prisma.orderPickupClaim.findUnique({ where: { id: preview.claimId } }),
          ).toMatchObject({ consumedAt: null });
        }
        const collected = await pickup.handover(f.actor, f.order.id, handover, context);
        expect(collected).toMatchObject({
          complete: firstQuantity === 2,
          lines: selectedLines,
        });
        expect(
          await pickup.handover(f.actor, f.order.id, handover, context),
        ).toMatchObject({ id: collected.id, replayed: true });
        const saved = await prisma.orderPickupHandover.findUniqueOrThrow({
          where: { id: collected.id },
        });
        expect(saved.unitRanges).toEqual(
          firstQuantity === 2
            ? [
                { orderItemId: item.id, offset: 0, quantity: 1 },
                { orderItemId: item.id, offset: 2, quantity: 1 },
              ]
            : [{ orderItemId: item.id, offset: 0, quantity: 1 }],
        );
        expect(saved.financialSnapshot).toMatchObject({
          version: "ORDER_PICKUP_CLEARANCE_V2",
          coverage: {
            originalKobo: "320",
            refundedKobo: f.refundBody.amountKobo.toString(),
            remainingKobo: (320n - f.refundBody.amountKobo).toString(),
          },
        });
        if (firstQuantity === 1) {
          const afterPartial = await pickup.read(buyer, f.order.id);
          expect(afterPartial.remaining).toEqual([{ orderItemId: item.id, quantity: 1 }]);
          const orderAfterPartial = await prisma.order.findUniqueOrThrow({
            where: { id: f.order.id },
          });
          expect(orderAfterPartial.status).toBe("READY");
          const secondCode = await pickup.issue(
            buyer,
            f.order.id,
            {
              expectedVersion: orderAfterPartial.version,
              idempotencyKey: randomUUID(),
              lines: afterPartial.remaining,
            },
            context,
          );
          const orderAfterIssue = await prisma.order.findUniqueOrThrow({
            where: { id: f.order.id },
          });
          const secondReview = await pickup.verify(f.actor, f.order.id, {
            expectedVersion: orderAfterIssue.version,
            pickupCode: secondCode.pickupCode!,
            lines: afterPartial.remaining,
          });
          const second = await pickup.handover(
            f.actor,
            f.order.id,
            {
              ...handover,
              expectedVersion: secondReview.version,
              pickupCode: secondCode.pickupCode!,
              claimId: secondReview.claimId,
              authorisationId: secondReview.authorisationId,
              financialReviewHash: secondReview.financialReviewHash,
              idempotencyKey: randomUUID(),
              lines: afterPartial.remaining,
            },
            context,
          );
          expect(second.complete).toBe(true);
          const secondSaved = await prisma.orderPickupHandover.findUniqueOrThrow({
            where: { id: second.id },
          });
          expect(secondSaved.unitRanges).toEqual([
            { orderItemId: item.id, offset: 2, quantity: 1 },
          ]);
          expect(
            await prisma.orderPickupHandover.count({ where: { orderId: f.order.id } }),
          ).toBe(2);
        }
        expect(
          await prisma.order.findUnique({ where: { id: f.order.id } }),
        ).toMatchObject({
          status: "COMPLETED",
          totalKobo: 320n,
          subtotalKobo: 303n,
          taxKobo: 22n,
          discountAmountKobo: 5n,
        });
        expect((await pickup.read(buyer, f.order.id)).remaining).toEqual([]);
        expect(
          await prisma.inventory.findUnique({ where: { id: inventory.id } }),
        ).toMatchObject({ quantity: 8, reserved: 0 });
      },
    );
    it("verifies affected settlement only after real independent manual checking and its ledger, keeping physical holds", async () => {
      const f = await refundFixture();
      const saved = refundReceipt(
        await f.payments.requestRefund(f.actor, f.refundBody, randomUUID(), context),
      );
      const resolutionInput = {
        expectedVersion: 2,
        idempotencyKey: randomUUID(),
        supplyExceptionId: f.concern.id,
        reason: "Synthetic actual original settlement and physical history reviewed",
        settlementAndPhysicalHistoryReviewed: true,
      };
      await expect(
        f.service.resolve(f.actor, f.order.id, resolutionInput, context),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        prisma.$transaction((tx) =>
          readSupplyRefundSettlement(tx, f.order.id, f.concern.id),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await f.payments.decideRefund(
        await independentApprover(),
        saved.refund.id,
        { decision: "APPROVED" },
        context,
      );
      const transfer = await independentApprover("REFUND_TRANSFER"),
        checker = await independentApprover("REFUND_CHECK");
      const ticket = issuePaymentEvidenceTicket({
        actorUserId: transfer.userId,
        paymentId: saved.refund.id,
        mimeType: "application/pdf",
        sizeBytes: 1,
        checksumSha256: "a".repeat(64),
      });
      const storage = vi.spyOn(objectStorage, "verifyObject").mockResolvedValue(true);
      try {
        const manual = new ManualRefundsService();
        await manual.recordTransfer(
          transfer,
          saved.refund.id,
          {
            bankReference: "synthetic-affected-bank-reference",
            transferredAt: (
              await prisma.$transaction((tx) => databaseClock(tx))
            ).toISOString(),
            evidenceToken: ticket.ticket,
            beneficiary: {
              bankName: "Synthetic bank",
              accountName: "Synthetic actual recipient",
              accountNumber: "0000000000",
            },
          },
          context,
        );
        await expect(
          prisma.$transaction((tx) =>
            readSupplyRefundSettlement(tx, f.order.id, f.concern.id),
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 60000);
        try {
          await manual.check(
            checker,
            saved.refund.id,
            true,
            "Synthetic independent evidence and beneficiary checked",
            context,
          );
        } finally {
          vi.useRealTimers();
        }
        const proof = await prisma.$transaction((tx) =>
          readSupplyRefundSettlement(tx, f.order.id, f.concern.id),
        );
        expect(proof).toMatchObject({
          amountKobo: "107",
          supplyExceptionId: f.concern.id,
          choiceId: f.choice.id,
        });
        expect(proof.refunds).toHaveLength(1);
        await expect(
          f.service.resolve(
            { ...f.actor, role: "STAFF" },
            f.order.id,
            resolutionInput,
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 403 });
        await expect(
          f.service.resolve(
            { ...f.actor, mfaVerifiedAt: null },
            f.order.id,
            resolutionInput,
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 403 });
        await expect(
          f.service.resolve(
            f.actor,
            f.order.id,
            { ...resolutionInput, expectedVersion: 1 },
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
        const resolved = await f.service.resolve(
          f.actor,
          f.order.id,
          resolutionInput,
          context,
        );
        expect(resolved.orderVersion).toBe(3);
        expect(resolved.replayed).toBe(false);
        expect(resolved.items[0]!.resolution).toMatchObject({
          unfulfilledLines: f.body.affectedLines,
          previouslyHandedLines: [],
        });
        const replayed = await f.service.resolve(
          f.actor,
          f.order.id,
          resolutionInput,
          context,
        );
        expect(replayed.replayed).toBe(true);
        expect(replayed.orderVersion).toBe(3);
        await expect(
          f.service.resolve(
            f.actor,
            f.order.id,
            { ...resolutionInput, reason: "Synthetic changed resolution details" },
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
        const stored = await prisma.orderSupplyResolution.findUniqueOrThrow({
          where: { supplyExceptionId: f.concern.id },
        });
        const current = await prisma.$transaction((tx) =>
          currentSupplyResolution(tx, f.order.id, f.concern.id),
        );
        expect(current.resolutionId).toBe(stored.id);
        await expect(
          prisma.orderSupplyResolution.create({
            data: {
              ...stored,
              id: randomUUID(),
              orderVersion: 3,
              idempotencyKey: randomUUID(),
              settlementProof: JSON.parse(JSON.stringify(stored.settlementProof)),
              unfulfilledLines: [],
              previouslyHandedLines: f.body.affectedLines,
            },
          }),
        ).rejects.toThrow(/Physical disposition/);
        await expect(
          prisma.orderSupplyResolution.create({
            data: {
              ...stored,
              id: randomUUID(),
              orderVersion: 3,
              idempotencyKey: randomUUID(),
              settlementProof: { ...proof, amountKobo: "1" },
              unfulfilledLines: f.body.affectedLines,
              previouslyHandedLines: [],
            },
          }),
        ).rejects.toThrow(/actual verified original refund/);

        await expect(
          prisma.orderSupplyResolution.update({
            where: { id: stored.id },
            data: { unfulfilledLines: [] },
          }),
        ).rejects.toThrow(/immutable/);
        await expect(
          prisma.orderSupplyResolution.delete({ where: { id: stored.id } }),
        ).rejects.toThrow(/immutable/);
        expect(JSON.stringify(await f.service.read(f.principal, f.order.id))).not.toMatch(
          /settlementProof|requestHash|idempotencyKey|sessionId|evidenceObjectKey|recordedByUserId/,
        );
        expect(
          await prisma.orderPickupHandover.count({ where: { orderId: f.order.id } }),
        ).toBe(0);
        const anomaly = await prisma.paymentAnomaly.create({
          data: {
            paymentAttemptId: proof.refunds[0]!.paymentAttemptId,
            type: "REFUND_MISMATCH",
            summary: "Synthetic later discrepancy",
          },
        });
        await expect(
          prisma.$transaction((tx) =>
            currentSupplyResolution(tx, f.order.id, f.concern.id),
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
        await prisma.paymentAnomaly.update({
          where: { id: anomaly.id },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            resolvedByUserId: checker.userId,
            resolutionNote: "Synthetic independent reconciliation completed",
          },
        });

        expect(JSON.stringify(proof)).not.toMatch(
          /synthetic-affected-bank|Synthetic bank|accountNumber|evidenceObjectKey/,
        );
        await expect(
          prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, f.order.id)),
        ).rejects.toMatchObject({ statusCode: 409 });
        await expect(
          prisma.$transaction((tx) =>
            readSupplyRefundSettlement(tx, f.order.id, randomUUID()),
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
      } finally {
        storage.mockRestore();
      }
    });
    it("caps concurrent scope requests and freezes a financially committed choice in both service and SQL", async () => {
      const f = await refundFixture();
      const attempts = await Promise.allSettled(
        [randomUUID(), randomUUID()].map((key) =>
          f.payments.requestRefund(f.actor, f.refundBody, key, context),
        ),
      );
      expect(attempts.filter((row) => row.status === "fulfilled")).toHaveLength(1);
      await expect(
        f.service.choose(
          f.principal,
          f.order.id,
          { ...choiceInput(f.concern.id, 2), choice: "SUITABLE_ALTERNATIVE_REVIEW" },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const stored = await prisma.orderSupplyRemedyChoice.findUniqueOrThrow({
        where: { id: f.choice.id },
      });
      await expect(
        prisma.orderSupplyRemedyChoice.create({
          data: {
            ...stored,
            id: randomUUID(),
            orderVersion: 2,
            choice: "SUITABLE_ALTERNATIVE_REVIEW",
            idempotencyKey: randomUUID(),
          },
        }),
      ).rejects.toThrow(/refund is already committed/);
      const refund = await prisma.refund.findFirstOrThrow({
        where: { supplyRemedyChoiceId: f.choice.id },
      });
      await expect(
        prisma.refund.create({
          data: {
            paymentAttemptId: f.attempt.id,
            supplyRemedyChoiceId: f.choice.id,
            requestedByUserId: f.actor.userId,
            id: randomUUID(),
            refundNumber: randomUUID(),
            idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
            amountKobo: 1n,
            reason: "Synthetic attempt to exceed the affected portion",
          },
        }),
      ).rejects.toThrow(/affected original portion/);
      await expect(prisma.refund.delete({ where: { id: refund.id } })).rejects.toThrow(
        /Refund rows cannot be physically deleted/,
      );
      await expect(
        prisma.refund.update({
          where: { id: refund.id },
          data: { supplyRemedyChoiceId: null },
        }),
      ).rejects.toThrow(/immutable/);
    });
    it("supports separate captured-amount requests only up to the exact full affected total and never deducts a fee", async () => {
      const f = await refundFixture();
      await f.payments.requestRefund(
        f.actor,
        { ...f.refundBody, amountKobo: 50n },
        randomUUID(),
        context,
      );
      await f.payments.requestRefund(
        f.actor,
        { ...f.refundBody, amountKobo: 57n },
        randomUUID(),
        context,
      );
      await expect(
        f.payments.requestRefund(
          f.actor,
          { ...f.refundBody, amountKobo: 1n },
          randomUUID(),
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const sum = await prisma.refund.aggregate({
        where: { supplyRemedyChoiceId: f.choice.id },
        _sum: { amountKobo: true },
      });
      expect(sum._sum.amountKobo).toBe(107n);
      expect(f.concern.monetaryBasis).toMatchObject({
        feeKobo: "0",
        amounts: { totalKobo: "107", taxKobo: "8" },
      });
    });
    it("refuses unbound, foreign, stale-choice and unreviewed historical/charge refunds", async () => {
      const f = await refundFixture(),
        other = await refundFixture();
      const { supplyRemedyChoiceId: _, ...unbound } = f.refundBody;
      void _;
      await expect(
        f.payments.requestRefund(f.actor, unbound, randomUUID(), context),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        f.payments.requestRefund(
          f.actor,
          { ...f.refundBody, paymentAttemptId: other.attempt.id },
          randomUUID(),
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const changed = await f.service.choose(
        f.principal,
        f.order.id,
        { ...choiceInput(f.concern.id, 2), choice: "SUITABLE_ALTERNATIVE_REVIEW" },
        context,
      );
      await expect(
        f.payments.requestRefund(f.actor, f.refundBody, randomUUID(), context),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        f.payments.requestRefund(
          f.actor,
          {
            ...f.refundBody,
            supplyRemedyChoiceId: changed.items[0]!.supplyRemedyChoices[0]!.id,
          },
          randomUUID(),
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const legacy = await fixture(false, { legacy: true });
      const concern = (
        await legacy.service.raise(legacy.actor, legacy.order.id, legacy.body, context)
      ).items[0]!;
      const choice = (
        await legacy.service.choose(
          legacy.principal,
          legacy.order.id,
          choiceInput(concern.id),
          context,
        )
      ).items[0]!.supplyRemedyChoices[0]!;
      const attempt = await captured(legacy);
      await expect(
        new PaymentsService().requestRefund(
          legacy.actor,
          {
            ...f.refundBody,
            paymentAttemptId: attempt.id,
            supplyRemedyChoiceId: choice.id,
          },
          randomUUID(),
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("holds attributable charges and used/installed claims for their actual separate review", async () => {
      for (const kind of ["CHARGES", "USED"] as const) {
        const f = await fixture(false, kind === "CHARGES" ? { deliveryFeeKobo: 7n } : {});
        const concern = (
          await f.service.raise(
            f.actor,
            f.order.id,
            {
              ...f.body,
              ...(kind === "USED" ? { kind: "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE" } : {}),
            },
            context,
          )
        ).items[0]!;
        const chosen = await f.service.choose(
          f.principal,
          f.order.id,
          {
            ...choiceInput(concern.id),
            ...(kind === "USED" ? { choice: "TECHNICAL_REVIEW" } : {}),
          },
          context,
        );
        const attempt = await captured(f, kind === "CHARGES" ? 327n : 320n);
        await expect(
          new PaymentsService().requestRefund(
            f.actor,
            {
              paymentAttemptId: attempt.id,
              amountKobo: 107n,
              supplyRemedyChoiceId: chosen.items[0]!.supplyRemedyChoices[0]!.id,
              reason:
                "Needs actual financial or technical review, not an invented entitlement",
            },
            randomUUID(),
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
      }
    });
    it("requires reconciliation of earlier unbound money and allows a new choice only after actual cancellation", async () => {
      const f = await refundFixture();
      const saved = refundReceipt(
        await f.payments.requestRefund(f.actor, f.refundBody, randomUUID(), context),
      );
      await f.payments.decideRefund(
        await independentApprover(),
        saved.refund.id,
        {
          decision: "CANCELLED",
          note: "Customer Care reviewing a different remedy; no money moved",
        },
        context,
      );
      const changed = await f.service.choose(
        f.principal,
        f.order.id,
        { ...choiceInput(f.concern.id, 2), choice: "SUITABLE_ALTERNATIVE_REVIEW" },
        context,
      );
      expect(changed.items[0]!.supplyRemedyChoices[1]!.refunds[0]!.status).toBe(
        "CANCELLED",
      );
      expect(changed.items[0]!.supplyRemedyChoices[0]!.choice).toBe(
        "SUITABLE_ALTERNATIVE_REVIEW",
      );
      const older = await fixture(),
        attempt = await captured(older),
        payments = new PaymentsService();
      await payments.requestRefund(
        older.actor,
        {
          paymentAttemptId: attempt.id,
          amountKobo: 5n,
          reason: "Earlier unbound synthetic refund requires reconciliation",
        },
        randomUUID(),
        context,
      );
      const concern = (
        await older.service.raise(older.actor, older.order.id, older.body, context)
      ).items[0]!;
      const choice = (
        await older.service.choose(
          older.principal,
          older.order.id,
          choiceInput(concern.id),
          context,
        )
      ).items[0]!.supplyRemedyChoices[0]!;
      await expect(
        payments.requestRefund(
          older.actor,
          {
            ...f.refundBody,
            paymentAttemptId: attempt.id,
            supplyRemedyChoiceId: choice.id,
          },
          randomUUID(),
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("preserves the existing approved full technical late-payment reversal despite a supply concern", async () => {
      const f = await fixture(false, { latePayment: true, legacy: true });
      await f.service.raise(f.actor, f.order.id, f.body, context);
      const prior = await prisma.businessPolicyVersion.findFirstOrThrow({
        where: { key: "order-payment" },
        orderBy: { version: "desc" },
      });
      const settings = z.record(z.string(), z.json()).parse(prior.settings);
      const policy = await prisma.businessPolicyVersion.create({
        data: {
          key: "order-payment",
          version: prior.version + 1,
          approvalStatus: "APPROVED",
          approvedByUserId: f.actor.userId,
          source: "Synthetic isolated late-reversal fixture; not production approval",
          sourceQuestion: "D17 compatibility fixture",
          effectiveAt: new Date(Date.now() - 1000),
          settings: { ...settings, lateCaptureAction: "PROVIDER_REVERSAL" },
        },
      });
      try {
        await cancelOriginal(f);
        const attempt = await captured(f, 320n, "PAYSTACK");
        await prisma.payment.update({
          where: { id: attempt.paymentId },
          data: {
            status: "SUCCEEDED",
            settledAttemptId: attempt.id,
            succeededAt: await prisma.$transaction((tx) => databaseClock(tx)),
          },
        });
        await prisma.paymentLedgerEntry.create({
          data: {
            paymentAttemptId: attempt.id,
            sourceKey: `capture:${attempt.id}`,
            type: "CAPTURE",
            direction: "CREDIT",
            amountKobo: 320n,
            occurredAt: attempt.paidAt!,
          },
        });
        for (let replay = 0; replay < 2; replay++)
          await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "PaymentAttempt" WHERE "id"=${attempt.id}::uuid FOR UPDATE`;
            await enqueueLateOrderRefund(tx, attempt.id);
          });
        const refunds = await prisma.refund.findMany({
          where: { paymentAttemptId: attempt.id },
        });
        expect(refunds).toHaveLength(1);
        expect(refunds[0]).toMatchObject({
          authorizationKind: "SYSTEM_LATE_ORDER",
          supplyRemedyChoiceId: null,
          amountKobo: 320n,
          status: "APPROVED",
          processedAt: null,
        });
        const providerRefundId = `synthetic-technical-${randomUUID()}`;
        const submit = vi.fn().mockResolvedValue({ providerRefundId, status: "pending" });
        const verify = vi.fn().mockResolvedValue({
          providerRefundId,
          status: "succeeded",
          amountKobo: 320n,
          currency: "NGN",
        });
        const worker = new RefundWorker(
          prisma,
          new PaymentProviderRegistry({
            PAYSTACK: {
              initialize: vi.fn(),
              verify: vi.fn(),
              refund: submit,
              verifyRefund: verify,
            },
          }),
        );
        await worker.runOnce(1, refunds[0]!.id);
        await prisma.refund.update({
          where: { id: refunds[0]!.id },
          data: {
            nextReconcileAt: new Date(
              (await prisma.$transaction((tx) => databaseClock(tx))).getTime() - 1000,
            ),
          },
        });
        await worker.runOnce(1, refunds[0]!.id);
        expect(submit).toHaveBeenCalledOnce();
        expect(verify).toHaveBeenCalledOnce();
        const result = await f.service.close(
          f.actor,
          f.order.id,
          cancelledReview(2),
          context,
        );
        expect(result.reconciliations[0]).toMatchObject({
          outcome: "CAPTURED_FUNDS_RETURNED",
          originalKobo: "320",
          capturedKobo: "320",
          refundedKobo: "320",
          cancelledUnits: 3,
        });
        expect(
          await prisma.orderPickupHandover.count({ where: { orderId: f.order.id } }),
        ).toBe(0);
      } finally {
        // Append a restoration; never edit immutable policy history or leak this
        // fixture's limited settings into later pre-payment/capture regressions.
        await prisma.businessPolicyVersion.create({
          data: {
            key: "order-payment",
            version: policy.version + 1,
            approvalStatus: prior.approvalStatus,
            approvedByUserId: prior.approvedByUserId,
            source: "Restored isolated test policy state; not production owner approval",
            sourceQuestion: "D17 isolated restore",
            effectiveAt: new Date(Date.now() - 1000),
            settings,
          },
        });
      }
      const restored = await prisma.businessPolicyVersion.findFirstOrThrow({
        where: { key: "order-payment" },
        orderBy: { version: "desc" },
      });
      expect(restored.settings).toEqual(prior.settings);
      expect(restored.approvalStatus).toBe(prior.approvalStatus);
    });
    it("binds exact affected quantities, creates a durable owned Care case and replays without duplicates", async () => {
      const f = await fixture();
      const first = await f.service.raise(f.actor, f.order.id, f.body, context);
      expect(first.items).toHaveLength(1);
      expect(first.items[0]!.monetaryBasis).toMatchObject({
        status: "SAVED_ORDER_ALLOCATION",
        feeKobo: "0",
        financialApproval: false,
        reviewOnly: true,
        amounts: { totalKobo: "107", taxKobo: "8" },
      });
      const replay = await f.service.raise(f.actor, f.order.id, f.body, context);
      expect(replay.items[0]!.id).toBe(first.items[0]!.id);
      expect(
        await prisma.orderSupplyException.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
      const caseRecord = await prisma.enquiry.findUniqueOrThrow({
        where: { id: first.items[0]!.enquiryId },
      });
      expect(caseRecord).toMatchObject({
        customerId: f.order.customerId,
        branchId: f.branch.id,
        status: "OPEN",
      });
      expect(caseRecord.message).not.toContain(f.body.reason);
      const safe = await f.service.read(f.principal, f.order.id);
      for (const secret of [
        f.body.reason,
        "requestHash",
        "idempotencyKey",
        "raisedByUserId",
        "sessionId",
      ])
        expect(JSON.stringify(safe)).not.toContain(secret);
      await expect(
        f.service.raise(
          f.actor,
          f.order.id,
          { ...f.body, reason: "Changed replay contents must not create another case" },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.refund.count({
          where: { paymentAttempt: { payment: { orderId: f.order.id } } },
        }),
      ).toBe(0);
      await expect(
        prisma.orderSupplyException.delete({ where: { id: first.items[0]!.id } }),
      ).rejects.toThrow();
      await expect(
        prisma.orderSupplyException.update({
          where: { id: first.items[0]!.id },
          data: { reason: "Rewritten facts" },
        }),
      ).rejects.toThrow();
    });
    it("serializes overlapping intake and blocks another charge while preserving original values", async () => {
      const f = await fixture();
      const results = await Promise.allSettled([
        f.service.raise(f.actor, f.order.id, f.body, context),
        f.service.raise(
          f.actor,
          f.order.id,
          { ...f.body, idempotencyKey: randomUUID() },
          context,
        ),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(
        await prisma.orderSupplyException.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, f.order.id)),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("supply concern"),
      });
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })).totalKobo,
      ).toBe(320n);
      expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(0);
    });
    it("requires actual current administrator MFA and keeps customer/guest ownership private", async () => {
      const f = await fixture(true),
        other = await fixture();
      await expect(
        f.service.raise({ ...f.actor, mfaVerifiedAt: null }, f.order.id, f.body, context),
      ).rejects.toMatchObject({ statusCode: 403 });
      await f.service.raise(f.actor, f.order.id, f.body, context);
      expect((await f.service.read(f.principal, f.order.id)).items).toHaveLength(1);
      await expect(f.service.read(other.principal, f.order.id)).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(
        f.service.read({ kind: "account", actor: f.customerActor }, f.order.id),
      ).rejects.toMatchObject({ statusCode: 404 });
      await prisma.session.update({
        where: { id: f.actor.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(
        f.service.readStaff(f.actor, f.order.id, context),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });
    it("retains actual staff branch scope, restricted private notes and a real Care alert", async () => {
      const f = await fixture(),
        other = await fixture();
      const staff = await prisma.user.create({
        data: {
          email: `supply-care-${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-staff",
          role: "STAFF",
          emailVerifiedAt: new Date(),
          staffProfile: {
            create: { firstName: "Synthetic", lastName: "Care", branchId: f.branch.id },
          },
        },
      });
      const actor: AuthenticatedActor = {
        ...f.actor,
        userId: staff.id,
        email: staff.email,
        role: "STAFF",
        sessionId: await paymentTestSession(staff.id, "STAFF"),
      };
      await expect(
        f.service.raise(actor, f.order.id, f.body, context),
      ).rejects.toMatchObject({ statusCode: 403 });
      const result = await f.service.raise(f.actor, f.order.id, f.body, context);
      expect(
        JSON.stringify(await f.service.readStaff(actor, f.order.id, context)),
      ).not.toContain(f.body.reason);
      expect(
        await prisma.notification.count({
          where: {
            userId: staff.id,
            resourceType: "ENQUIRY",
            resourceId: result.items[0]!.enquiryId,
          },
        }),
      ).toBe(1);
      await expect(
        f.service.readStaff(actor, other.order.id, context),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
      await prisma.staffProfile.update({
        where: { userId: staff.id },
        data: { branchId: null },
      });
      await expect(f.service.readStaff(actor, f.order.id, context)).rejects.toMatchObject(
        {
          statusCode: 403,
        },
      );
    });
    it("keeps used/installed/disputed reports in technical assessment rather than inventing a refund policy", async () => {
      const f = await fixture();
      const result = await f.service.raise(
        f.actor,
        f.order.id,
        { ...f.body, kind: "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE" },
        context,
      );
      expect(result.items[0]!.monetaryBasis).toMatchObject({
        status: "TECHNICAL_ASSESSMENT_REQUIRED",
        amounts: null,
        feeKobo: null,
        financialApproval: false,
      });
    });
    it("automatically routes an unavailable sourcing update once without silently resolving it on an estimate change", async () => {
      const f = await fixture(),
        orders = new OrdersService();
      const input = {
        expectedVersion: 0,
        idempotencyKey: randomUUID(),
        lines: f.order.items.map((item) => ({
          orderItemId: item.id,
          sourcingStatus: "UNAVAILABLE",
          sourcingFrom: null,
          sourcingUntil: null,
          preparationMinutes: null,
        })),
        customerNote: f.body.customerNote,
        reason: f.body.reason,
      };
      await orders.updateTiming(f.actor, f.order.id, input, context);
      const first = await f.service.readStaff(f.actor, f.order.id, context);
      expect(first.items).toHaveLength(1);
      await orders.updateTiming(
        f.actor,
        f.order.id,
        { ...input, expectedVersion: 1, idempotencyKey: randomUUID() },
        context,
      );
      expect(
        (await f.service.readStaff(f.actor, f.order.id, context)).items,
      ).toHaveLength(1);
      const stored = await prisma.orderSupplyException.findUniqueOrThrow({
        where: { id: first.items[0]!.id },
      });
      expect(stored.sourceTimingUpdateId).toBeTruthy();
      expect(stored.affectedLines).toEqual([
        { orderItemId: f.order.items[0]!.id, offset: 0, quantity: 3 },
      ]);
      await orders.updateTiming(
        f.actor,
        f.order.id,
        {
          ...input,
          expectedVersion: 2,
          idempotencyKey: randomUUID(),
          lines: input.lines.map((line) => ({ ...line, sourcingStatus: "ARRIVED" })),
        },
        context,
      );
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, f.order.id)),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("supply concern"),
      });
    });
    it("enforces HTTP CSRF and returns only safe buyer projection", async () => {
      const f = await fixture(),
        app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        now = new Date(),
        expiresAt = new Date(now.getTime() + 3600000);
      await prisma.session.create({
        data: {
          userId: f.actor.userId,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          createdAt: new Date(now.getTime() - 1000),
          expiresAt,
          idleExpiresAt: expiresAt,
          mfaRequired: true,
          mfaVerifiedAt: now,
        },
      });
      const headers = {
        Cookie: `${sessionCookieName}=${token}`,
        Origin: env.FRONTEND_URL[0]!,
      };
      const missing = await request(app)
        .post(`/api/v1/staff/orders/${f.order.id}/supply-exceptions`)
        .set(headers)
        .send(f.body);
      expect(missing.status).toBe(403);
      expect(
        await prisma.orderSupplyException.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
      const saved = await request(app)
        .post(`/api/v1/staff/orders/${f.order.id}/supply-exceptions`)
        .set(headers)
        .set("x-csrf-token", csrf)
        .send(f.body);
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      const read = await request(app)
        .get(`/api/v1/customers/orders/${f.order.id}/supply-exceptions`)
        .set("Cookie", f.buyer.cookie);
      expect(read.status, JSON.stringify(read.body)).toBe(200);
      expect(read.body.data.orderId).toBe(f.order.id);
      expect(JSON.stringify(read.body)).not.toContain(f.body.reason);
      for (const [path, cookie] of [
        [`/api/v1/customers/orders/${f.order.id}`, f.buyer.cookie],
        [`/api/v1/staff/orders/${f.order.id}`, headers.Cookie],
      ] as const) {
        const detail = await request(app).get(path).set("Cookie", cookie);
        expect(detail.status, JSON.stringify(detail.body)).toBe(200);
        expect(detail.body.data.supplyConcernCapabilityVersion).toBe(1);
      }
      const g = await fixture(true);
      const guestDetail = await request(app)
        .get(`/api/v1/purchase/orders/${g.order.id}`)
        .set("Cookie", `${purchaseCookieName}=${g.access!.sessionToken}`);
      expect(guestDetail.status, JSON.stringify(guestDetail.body)).toBe(200);
      expect(guestDetail.body.data.supplyConcernCapabilityVersion).toBe(1);
    });
  },
);
