import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { hashToken } from "../../common/security/session-tokens.js";
import {
  issuePaymentEvidenceTicket,
  readPaymentEvidenceTicket,
} from "../../common/security/payment-evidence-tickets.js";
import {
  openPaymentCheckoutState,
  sealPaymentCheckoutState,
} from "../../common/security/payment-checkout-state.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { PaymentMethod } from "../../generated/prisma/enums.js";
import type { VerifiedPayment } from "../../providers/payments/payment-provider.port.js";
import {
  paymentProviders,
  PaymentProviderRegistry,
  type OnlinePaymentProvider,
} from "../../providers/payments/payment-provider.registry.js";
import type { PaystackWebhookEvent } from "../../providers/payments/paystack-webhook.js";
import type { MonnifyWebhookEvent } from "../../providers/payments/monnify-webhook.js";
import type { ObjectStoragePort } from "../../providers/storage/object-storage.port.js";
import { objectStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import { scheduleReminders } from "../service-operations/service-operations.service.js";
import {
  paymentConflict,
  paymentIdempotencyConflict,
  paymentNotFound,
  paymentVerificationFailed,
} from "./payments.errors.js";
import {
  assertPaymentApprover,
  assertPaymentCustomer,
  assertPaymentOperator,
} from "./payments.policy.js";
import { PaymentsRepository } from "./payments.repository.js";
import type {
  ManualPaymentInput,
  ManualReviewInput,
  PaymentCreateInput,
  PaymentListQuery,
  PaymentEvidenceUploadInput,
  RefundCreateInput,
  RefundDecisionInput,
  StaffPaymentListQuery,
} from "./payments.schemas.js";
import { paymentFingerprint, paymentJsonSafe, paymentPage } from "./payments.types.js";

const paymentNumber = () =>
  `PAY-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
const refundNumber = () =>
  `REF-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
const methodMap: Readonly<Record<string, PaymentMethod>> = {
  card: "CARD",
  bank: "BANK_TRANSFER",
  bank_transfer: "BANK_TRANSFER",
  ussd: "USSD",
  mobile_money: "MOBILE_MONEY",
  qr: "QR",
  pos: "POS",
  account_transfer: "BANK_TRANSFER",
};
const monnifyTransactionRetrySchema = z
  .object({
    kind: z.literal("transaction"),
    reference: z.string().min(1).max(120),
    gatewayTransactionId: z.string().min(1).max(160),
    status: z.enum(["success", "failed", "abandoned", "pending"]),
    amountKobo: z.string().regex(/^\d+$/),
    currency: z.string().length(3),
    paidAt: z.string().nullable(),
    providerFeeKobo: z.string().regex(/^\d+$/).nullable(),
    method: z.string().max(80).nullable(),
  })
  .strict();
const monnifyRefundRetrySchema = z
  .object({
    kind: z.literal("refund"),
    providerRefundId: z.string().min(1).max(160),
    status: z.enum(["pending", "succeeded", "failed"]),
    amountKobo: z.string().regex(/^\d+$/).nullable(),
    currency: z.string().length(3).nullable(),
  })
  .strict();

export class PaymentsService {
  private readonly repository: PaymentsRepository;
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly providers: PaymentProviderRegistry = paymentProviders,
    private readonly storage: ObjectStoragePort = objectStorage,
  ) {
    this.repository = new PaymentsRepository(database);
  }

  async customerList(actor: AuthenticatedActor, query: PaymentListQuery) {
    assertPaymentCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (!profile) throw paymentNotFound();
    return paymentJsonSafe(
      paymentPage(await this.repository.listCustomer(profile.id, query), query.limit),
    );
  }
  async customerGet(actor: AuthenticatedActor, id: string) {
    assertPaymentCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (!profile) throw paymentNotFound();
    const payment = await this.repository.owned(id, profile.id);
    if (!payment) throw paymentNotFound();
    return paymentJsonSafe(payment);
  }
  async staffList(actor: AuthenticatedActor, query: StaffPaymentListQuery) {
    assertPaymentOperator(actor);
    const branchId = await this.allowedBranch(actor);
    return paymentJsonSafe(
      paymentPage(await this.repository.listStaff(query, branchId), query.limit),
    );
  }

  async createIntent(
    actor: AuthenticatedActor,
    input: PaymentCreateInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    assertPaymentCustomer(actor);
    const keyHash = hashToken("payment-intent-idempotency", `${actor.userId}:${rawKey}`);
    const fingerprint = paymentFingerprint(input);
    return this.database.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payment:${keyHash}`}, 0))`;
      const profile = await this.repository.customerProfile(actor.userId, tx);
      if (!profile) throw paymentNotFound();
      const source = await this.resolveSource(profile.id, input, tx);
      const existing = await this.repository.byIdempotency(keyHash, tx);
      if (existing) {
        const same =
          existing.purpose === input.purpose &&
          existing.orderId === (input.targetType === "ORDER" ? input.targetId : null) &&
          existing.invoiceId ===
            (input.targetType === "INVOICE" ? input.targetId : null) &&
          existing.vehicleTransactionId ===
            (input.targetType === "VEHICLE_TRANSACTION" ? input.targetId : null) &&
          existing.amountKobo === source.amountKobo;
        if (!same) throw paymentIdempotencyConflict();
        return paymentJsonSafe({ payment: existing, replayed: true });
      }
      const expiresAt =
        source.expiresAt ?? new Date(Date.now() + env.PAYMENT_INTENT_TTL_SECONDS * 1_000);
      if (expiresAt <= new Date()) throw paymentConflict("The payable has expired");
      const payment = await this.repository.create(
        {
          customerId: profile.id,
          paymentNumber: paymentNumber(),
          purpose: input.purpose,
          amountKobo: source.amountKobo,
          currency: "NGN",
          idempotencyKeyHash: keyHash,
          expiresAt,
          description: `Payment ${fingerprint.slice(0, 12)}`,
          ...(input.targetType === "ORDER" ? { orderId: input.targetId } : {}),
          ...(input.targetType === "INVOICE" ? { invoiceId: input.targetId } : {}),
          ...(input.targetType === "VEHICLE_TRANSACTION"
            ? { vehicleTransactionId: input.targetId }
            : {}),
        },
        tx,
      );
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "PAYMENT",
        entityId: payment.id,
        newValues: {
          purpose: payment.purpose,
          amountKobo: payment.amountKobo.toString(),
          currency: payment.currency,
        },
        context,
      });
      return paymentJsonSafe({ payment, replayed: false });
    });
  }

  async initializePaystack(
    actor: AuthenticatedActor,
    id: string,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    return this.initializeOnlineProvider(actor, id, rawKey, context, "PAYSTACK");
  }

  async initializeMonnify(
    actor: AuthenticatedActor,
    id: string,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    return this.initializeOnlineProvider(actor, id, rawKey, context, "MONNIFY");
  }

  private async initializeOnlineProvider(
    actor: AuthenticatedActor,
    id: string,
    rawKey: string,
    context: RequestSecurityContext,
    provider: OnlinePaymentProvider,
  ) {
    assertPaymentCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (!profile) throw paymentNotFound();
    const attemptKey = hashToken(
      "payment-attempt-idempotency",
      `${provider}:${id}:${rawKey}`,
    );
    const reference = `AAT-${provider}-${attemptKey.slice(0, 32)}`;
    const prepared = await this.database.$transaction(async (tx) => {
      const payment = await this.repository.lockPayment(id, tx);
      if (!payment || payment.customerId !== profile.id) throw paymentNotFound();
      this.assertPayable(payment);
      const existing = await tx.paymentAttempt.findUnique({
        where: { internalReference: reference },
      });
      if (existing) {
        if (existing.provider !== provider) throw paymentConflict();
        if (existing.encryptedCheckoutState && existing.authorizationExpiresAt) {
          let state;
          try {
            state = openPaymentCheckoutState(existing.encryptedCheckoutState);
          } catch {
            throw paymentConflict("Payment checkout state is unavailable");
          }
          if (
            state.provider === provider &&
            existing.authorizationExpiresAt > new Date() &&
            new Date(state.expiresAt) > new Date()
          )
            return { payment, existing, checkout: state };
          throw paymentConflict("The payment checkout has expired; start a new attempt");
        }
        throw paymentConflict("Payment initialization is already in progress");
      }
      const latest = await tx.paymentAttempt.aggregate({
        where: { paymentId: id },
        _max: { attemptNumber: true },
      });
      const attempt = await this.repository.createAttempt(
        {
          paymentId: id,
          attemptNumber: (latest._max.attemptNumber ?? 0) + 1,
          internalReference: reference,
          provider,
          status: "INITIALIZED",
          amountKobo: payment.amountKobo,
          currency: payment.currency,
        },
        tx,
      );
      return { payment, existing: attempt, checkout: null };
    });
    if (prepared.checkout)
      return {
        attemptId: prepared.existing.id,
        authorizationUrl: prepared.checkout.authorizationUrl,
        authorizationExpiresAt: prepared.checkout.expiresAt,
        ...(provider === "PAYSTACK" ? { accessCode: prepared.checkout.accessCode } : {}),
        replayed: true,
      };
    const callbackUrl =
      provider === "PAYSTACK" ? env.PAYSTACK_CALLBACK_URL : env.MONNIFY_CALLBACK_URL;
    const ownedCallbackUrl = callbackUrl
      ? (() => {
          const url = new URL(callbackUrl);
          url.searchParams.set("paymentId", id);
          url.searchParams.set("attemptId", prepared.existing.id);
          return url.toString();
        })()
      : undefined;
    const initialized = await this.providers.get(provider).initialize({
      email: profile.user.email,
      customerName: `${profile.firstName} ${profile.lastName}`,
      amountKobo: prepared.payment.amountKobo,
      currency: "NGN",
      reference,
      ...(ownedCallbackUrl ? { callbackUrl: ownedCallbackUrl } : {}),
    });
    if (initialized.providerReference !== reference) throw paymentVerificationFailed();
    const authorizationExpiresAt = new Date(
      Math.min(
        initialized.authorizationExpiresAt.getTime(),
        prepared.payment.expiresAt?.getTime() ??
          initialized.authorizationExpiresAt.getTime(),
      ),
    );
    if (authorizationExpiresAt <= new Date())
      throw paymentConflict("The payable expired during checkout initialization");
    await this.database.$transaction(async (tx) => {
      await tx.paymentAttempt.update({
        where: { id: prepared.existing.id },
        data: {
          status: "PENDING",
          providerReference: reference,
          encryptedCheckoutState: sealPaymentCheckoutState({
            provider,
            authorizationUrl: initialized.authorizationUrl,
            accessCode: initialized.accessCode,
            expiresAt: authorizationExpiresAt.toISOString(),
          }),
          authorizationExpiresAt,
          redactedGatewayData: {
            checkoutMethod: provider === "MONNIFY" ? "PAY_WITH_BANK" : "HOSTED",
          },
        },
      });
      await tx.payment.updateMany({
        where: { id, status: "REQUIRES_PAYMENT" },
        data: { status: "PROCESSING" },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "PAYMENT_INITIALIZED",
        entityType: "PAYMENT_ATTEMPT",
        entityId: prepared.existing.id,
        newValues: { provider, paymentId: id },
        context,
      });
    });
    return {
      attemptId: prepared.existing.id,
      authorizationUrl: initialized.authorizationUrl,
      authorizationExpiresAt: authorizationExpiresAt.toISOString(),
      ...(provider === "PAYSTACK" ? { accessCode: initialized.accessCode } : {}),
      replayed: false,
    };
  }

  async verifyAttempt(
    actor: AuthenticatedActor,
    paymentId: string,
    attemptId: string,
    context: RequestSecurityContext,
  ) {
    assertPaymentCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    const attempt = await this.repository.attempt(attemptId);
    if (
      !profile ||
      !attempt ||
      attempt.paymentId !== paymentId ||
      attempt.payment.customerId !== profile.id ||
      attempt.provider === "MANUAL"
    )
      throw paymentNotFound();
    const verified = await this.providers
      .get(attempt.provider as OnlinePaymentProvider)
      .verify(attempt.internalReference);
    await this.applyVerifiedAttempt(attempt.id, verified, context, actor.userId);
    return this.customerGet(actor, paymentId);
  }

  async submitManual(
    actor: AuthenticatedActor,
    id: string,
    input: ManualPaymentInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    assertPaymentCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (!profile) throw paymentNotFound();
    const evidence = input.evidenceToken
      ? this.readEvidence(input.evidenceToken, actor.userId, id)
      : null;
    if (
      evidence &&
      !(await this.storage.verifyObject({
        key: evidence.objectKey,
        mimeType: evidence.mimeType,
        sizeBytes: evidence.sizeBytes,
        checksumSha256: evidence.checksumSha256,
      }))
    )
      throw paymentConflict("Payment evidence could not be verified");
    const referenceHash = hashToken(
      "payment-attempt-idempotency",
      `MANUAL:${id}:${rawKey}`,
    );
    const reference = `AAT-MANUAL-${referenceHash.slice(0, 32)}`;
    const requestFingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    return this.database.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`manual-payment:${reference}`}, 0))`;
      const payment = await this.repository.lockPayment(id, tx);
      if (!payment || payment.customerId !== profile.id) throw paymentNotFound();
      const existing = await tx.paymentAttempt.findUnique({
        where: { internalReference: reference },
        select: {
          paymentId: true,
          provider: true,
          redactedGatewayData: true,
        },
      });
      if (existing) {
        const metadata =
          existing.redactedGatewayData !== null &&
          typeof existing.redactedGatewayData === "object" &&
          !Array.isArray(existing.redactedGatewayData)
            ? existing.redactedGatewayData
            : {};
        if (
          existing.paymentId !== id ||
          existing.provider !== "MANUAL" ||
          metadata["requestFingerprint"] !== requestFingerprint
        )
          throw paymentIdempotencyConflict();
        return paymentJsonSafe({
          ...(await this.repository.get(id, tx)),
          replayed: true,
        });
      }
      this.assertPayable(payment);
      const latest = await tx.paymentAttempt.aggregate({
        where: { paymentId: id },
        _max: { attemptNumber: true },
      });
      const attempt = await this.repository.createAttempt(
        {
          paymentId: id,
          attemptNumber: (latest._max.attemptNumber ?? 0) + 1,
          internalReference: reference,
          provider: "MANUAL",
          method: input.method,
          status: "PENDING",
          verificationStatus: "UNVERIFIED",
          amountKobo: payment.amountKobo,
          currency: payment.currency,
          redactedGatewayData: { requestFingerprint },
        },
        tx,
      );
      await tx.manualPaymentReview.create({
        data: {
          paymentAttemptId: attempt.id,
          submittedByUserId: actor.userId,
          ...(input.bankReference ? { bankReference: input.bankReference } : {}),
          payerName: input.payerName,
          transferredAt: new Date(input.transferredAt),
          ...(evidence
            ? {
                evidenceObjectKey: evidence.objectKey,
                evidenceSha256: evidence.checksumSha256,
              }
            : {}),
        },
      });
      await tx.payment.update({ where: { id }, data: { status: "REQUIRES_REVIEW" } });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "PAYMENT_ATTEMPT",
        entityId: attempt.id,
        newValues: { provider: "MANUAL", paymentId: id },
        context,
      });
      return paymentJsonSafe({
        ...(await this.repository.get(id, tx)),
        replayed: false,
      });
    });
  }

  async createEvidenceUpload(
    actor: AuthenticatedActor,
    paymentId: string,
    input: PaymentEvidenceUploadInput,
  ) {
    assertPaymentCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (!profile || !(await this.repository.owned(paymentId, profile.id)))
      throw paymentNotFound();
    const issued = issuePaymentEvidenceTicket({
      actorUserId: actor.userId,
      paymentId,
      ...input,
    });
    return {
      upload: await this.storage.createUpload({
        key: issued.payload.objectKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
      }),
      evidenceToken: issued.ticket,
    };
  }

  async reviewManual(
    actor: AuthenticatedActor,
    attemptId: string,
    input: ManualReviewInput,
    context: RequestSecurityContext,
  ) {
    assertPaymentApprover(actor);
    return this.database.$transaction(async (tx) => {
      const attempt = await tx.paymentAttempt.findUnique({
        where: { id: attemptId },
        include: { manualReview: true, payment: true },
      });
      if (!attempt?.manualReview || attempt.provider !== "MANUAL")
        throw paymentNotFound();
      if (attempt.manualReview.status !== "PENDING")
        throw paymentConflict("Manual payment was already reviewed");
      if (attempt.manualReview.submittedByUserId === actor.userId)
        throw paymentConflict("A different operator must approve this payment");
      const now = new Date();
      await tx.manualPaymentReview.update({
        where: { id: attempt.manualReview.id },
        data: {
          status: input.decision,
          reviewedByUserId: actor.userId,
          reviewedAt: now,
          reviewerNote: input.reviewerNote,
        },
      });
      if (input.decision === "APPROVED") {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "SUCCESSFUL",
            verificationStatus: "VERIFIED",
            verifiedAmountKobo: attempt.amountKobo,
            verifiedCurrency: attempt.currency,
            paidAt: attempt.manualReview.transferredAt ?? now,
            verifiedAt: now,
          },
        });
        await this.settle(
          tx,
          attempt.paymentId,
          attempt.id,
          attempt.manualReview.transferredAt ?? now,
        );
      } else {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "FAILED",
            failureCode: "MANUAL_REJECTED",
            failureMessage: "Manual payment evidence was rejected",
            failedAt: now,
          },
        });
        await tx.payment.updateMany({
          where: { id: attempt.paymentId, status: "REQUIRES_REVIEW" },
          data: { status: "REQUIRES_PAYMENT" },
        });
      }
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action:
          input.decision === "APPROVED" ? "MANUAL_PAYMENT_APPROVED" : "STATUS_CHANGE",
        entityType: "PAYMENT_ATTEMPT",
        entityId: attempt.id,
        newValues: { decision: input.decision },
        context,
      });
      return paymentJsonSafe(await this.repository.get(attempt.paymentId, tx));
    });
  }

  async manualEvidenceAccess(
    actor: AuthenticatedActor,
    attemptId: string,
    context: RequestSecurityContext,
  ) {
    assertPaymentOperator(actor);
    const attempt = await this.repository.attempt(attemptId);
    if (!attempt?.manualReview?.evidenceObjectKey) throw paymentNotFound();
    await this.assertBranch(actor, attempt.paymentId);
    await this.database.$transaction((tx) =>
      appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "PAYMENT_ATTEMPT",
        entityId: attemptId,
        newValues: { privateEvidence: true },
        context,
      }),
    );
    return {
      url: await this.storage.createView(attempt.manualReview.evidenceObjectKey),
      expiresInSeconds: env.ASSET_DOWNLOAD_TTL_SECONDS,
    };
  }

  async requestRefund(
    actor: AuthenticatedActor,
    input: RefundCreateInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    assertPaymentOperator(actor);
    const keyHash = hashToken(
      "refund-idempotency",
      `${input.paymentAttemptId}:${rawKey}`,
    );
    return this.database.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`refund:${keyHash}`}, 0))`;
      const existing = await tx.refund.findUnique({
        where: { idempotencyKeyHash: keyHash },
      });
      if (existing) {
        if (
          existing.paymentAttemptId !== input.paymentAttemptId ||
          existing.amountKobo !== input.amountKobo ||
          existing.reason !== input.reason
        )
          throw paymentIdempotencyConflict();
        return paymentJsonSafe({ refund: existing, replayed: true });
      }
      const attempt = await this.repository.attempt(input.paymentAttemptId, tx);
      if (
        !attempt ||
        attempt.status !== "SUCCESSFUL" ||
        attempt.verificationStatus !== "VERIFIED"
      )
        throw paymentNotFound();
      await this.assertBranch(actor, attempt.paymentId, tx);
      await tx.$queryRaw`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${input.paymentAttemptId}::uuid FOR UPDATE`;
      const committed =
        (
          await tx.refund.aggregate({
            where: {
              paymentAttemptId: input.paymentAttemptId,
              status: { notIn: ["FAILED", "CANCELLED"] },
            },
            _sum: { amountKobo: true },
          })
        )._sum.amountKobo ?? 0n;
      if (committed + input.amountKobo > attempt.amountKobo)
        throw paymentConflict("Refund total exceeds the captured amount");
      const refund = await tx.refund.create({
        data: {
          paymentAttemptId: input.paymentAttemptId,
          requestedByUserId: actor.userId,
          refundNumber: refundNumber(),
          idempotencyKeyHash: keyHash,
          amountKobo: input.amountKobo,
          currency: attempt.currency,
          reason: input.reason,
        },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "REFUND_REQUESTED",
        entityType: "REFUND",
        entityId: refund.id,
        newValues: {
          amountKobo: refund.amountKobo.toString(),
          paymentAttemptId: input.paymentAttemptId,
        },
        context,
      });
      return paymentJsonSafe({ refund, replayed: false });
    });
  }

  async decideRefund(
    actor: AuthenticatedActor,
    id: string,
    input: RefundDecisionInput,
    context: RequestSecurityContext,
  ) {
    assertPaymentApprover(actor);
    const approved = await this.database.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "Refund" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (!rows.length) throw paymentNotFound();
      const refund = await tx.refund.findUnique({
        where: { id },
        include: { paymentAttempt: true },
      });
      if (!refund || refund.status !== "REQUESTED")
        throw paymentConflict("Refund was already decided");
      if (refund.requestedByUserId === actor.userId)
        throw paymentConflict("A different operator must approve this refund");
      const now = new Date();
      const updated = await tx.refund.update({
        where: { id },
        data:
          input.decision === "APPROVED"
            ? { status: "APPROVED", approvedByUserId: actor.userId, approvedAt: now }
            : {
                status: "CANCELLED",
                cancelledAt: now,
                ...(input.note ? { failureMessage: input.note } : {}),
              },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: input.decision === "APPROVED" ? "REFUND_APPROVED" : "STATUS_CHANGE",
        entityType: "REFUND",
        entityId: id,
        newValues: { decision: input.decision },
        context,
      });
      return { refund: updated, attempt: refund.paymentAttempt };
    });
    if (input.decision === "CANCELLED") return paymentJsonSafe(approved.refund);
    if (approved.attempt.provider === "MANUAL" || !approved.attempt.gatewayTransactionId)
      return paymentJsonSafe(
        await this.database.refund.update({
          where: { id },
          data: {
            status: "NEEDS_ATTENTION",
            providerStatus: "OFFLINE_PROCESSING_REQUIRED",
          },
        }),
      );
    let result;
    try {
      result = await this.providers
        .get(approved.attempt.provider as OnlinePaymentProvider)
        .refund({
          gatewayTransactionId: approved.attempt.gatewayTransactionId,
          amountKobo: approved.refund.amountKobo,
          currency: "NGN",
          refundReference: approved.refund.refundNumber,
          reason: approved.refund.reason,
          customerNote: "AAT refund",
        });
    } catch {
      return paymentJsonSafe(
        await this.database.refund.update({
          where: { id },
          data: {
            status: "NEEDS_ATTENTION",
            providerStatus: "PROVIDER_SUBMISSION_UNCONFIRMED",
            failureMessage: "Provider submission requires reviewed follow-up",
          },
        }),
      );
    }
    return paymentJsonSafe(
      await this.database.refund.update({
        where: { id },
        data: {
          status: "PENDING",
          providerRefundId: result.providerRefundId,
          providerStatus: result.status,
        },
      }),
    );
  }

  async ingestWebhook(
    event: PaystackWebhookEvent,
    payloadSha256: string,
    context: RequestSecurityContext,
  ) {
    const deduplicationKey = createHash("sha256")
      .update(`${event.eventType}:${event.providerEventId ?? ""}:${payloadSha256}`)
      .digest("hex");
    let duplicate = false;
    try {
      await this.database.paymentWebhookEvent.create({
        data: {
          provider: "PAYSTACK",
          providerEventId: event.providerEventId,
          deduplicationKey,
          eventType: event.eventType,
          payloadSha256,
          signatureVerifiedAt: new Date(),
          redactedPayload: {
            eventType: event.eventType,
            providerEventId: event.providerEventId,
            resourceId: event.resourceId,
            reference: event.reference,
            status: event.status,
            amountKobo: event.amountKobo?.toString() ?? null,
            currency: event.currency,
            gatewayTransactionId: event.gatewayTransactionId,
            paidAt: event.paidAt?.toISOString() ?? null,
            providerFeeKobo: event.providerFeeKobo?.toString() ?? null,
            method: event.method,
            category: event.category,
            responseDueAt: event.responseDueAt?.toISOString() ?? null,
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.database.paymentWebhookEvent.findUnique({
          where: {
            provider_deduplicationKey: { provider: "PAYSTACK", deduplicationKey },
          },
          select: { status: true },
        });
        if (!existing) throw error;
        if (existing.status === "PROCESSED") return { accepted: true, duplicate: true };
        duplicate = true;
      } else {
        throw error;
      }
    }
    if (event.eventType.startsWith("refund.")) {
      await this.applyRefundWebhook(event, deduplicationKey);
      return { accepted: true, duplicate };
    }
    if (event.eventType.startsWith("charge.dispute.")) {
      await this.applyDisputeWebhook(event, deduplicationKey, context);
      return { accepted: true, duplicate };
    }
    if (
      event.eventType !== "charge.success" ||
      !event.reference ||
      event.amountKobo === null ||
      !event.currency ||
      !event.gatewayTransactionId
    ) {
      await this.database.paymentWebhookEvent.update({
        where: { provider_deduplicationKey: { provider: "PAYSTACK", deduplicationKey } },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return { accepted: true, duplicate };
    }
    const attempt = await this.repository.attemptByReference(event.reference);
    if (!attempt) {
      await this.database.$transaction(async (tx) => {
        await tx.paymentWebhookEvent.update({
          where: {
            provider_deduplicationKey: { provider: "PAYSTACK", deduplicationKey },
          },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
      });
      return { accepted: true, duplicate: false };
    }
    await this.applyVerifiedAttempt(
      attempt.id,
      {
        reference: event.reference,
        gatewayTransactionId: event.gatewayTransactionId,
        status: "success",
        amountKobo: event.amountKobo,
        currency: event.currency,
        paidAt: event.paidAt,
        providerFeeKobo: event.providerFeeKobo,
        method: event.method,
      },
      context,
      null,
      { provider: "PAYSTACK", deduplicationKey },
    );
    return { accepted: true, duplicate };
  }

  async ingestMonnifyWebhook(
    event: MonnifyWebhookEvent,
    payloadSha256: string,
    signatureVerified: boolean,
    context: RequestSecurityContext,
  ) {
    if (event.kind === "ignored" && !signatureVerified)
      return { accepted: true, duplicate: false, ignored: true };

    const deduplicationKey = createHash("sha256")
      .update(`${event.eventType}:${event.providerEventId ?? ""}:${payloadSha256}`)
      .digest("hex");
    const existing = await this.database.paymentWebhookEvent.findFirst({
      where: {
        provider: "MONNIFY",
        OR: [
          { deduplicationKey },
          ...(event.providerEventId ? [{ providerEventId: event.providerEventId }] : []),
        ],
      },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status !== "PROCESSED")
        await this.retryMonnifyWebhook(existing.id, context);
      return { accepted: true, duplicate: true };
    }

    const now = new Date();
    if (event.kind === "ignored") {
      await this.database.paymentWebhookEvent.create({
        data: {
          provider: "MONNIFY",
          providerEventId: null,
          deduplicationKey,
          eventType: event.eventType,
          payloadSha256,
          signatureVerifiedAt: now,
          status: "PROCESSED",
          processedAt: now,
          redactedPayload: { kind: "ignored" },
        },
      });
      return { accepted: true, duplicate: false, ignored: true };
    }

    if (event.kind === "transaction") {
      const attempt = await this.repository.attemptByReference(event.reference);
      if (!attempt || attempt.provider !== "MONNIFY") {
        if (!signatureVerified)
          return { accepted: true, duplicate: false, ignored: true };
        await this.database.paymentWebhookEvent.create({
          data: {
            provider: "MONNIFY",
            providerEventId: event.providerEventId,
            deduplicationKey,
            eventType: event.eventType,
            payloadSha256,
            signatureVerifiedAt: now,
            status: "PROCESSED",
            processedAt: now,
            redactedPayload: { kind: "ignored", reason: "unknown-reference" },
          },
        });
        return { accepted: true, duplicate: false, ignored: true };
      }
      const verified = await this.providers.get("MONNIFY").verify(event.reference);
      const payload = {
        kind: "transaction" as const,
        reference: verified.reference,
        gatewayTransactionId: verified.gatewayTransactionId,
        status: verified.status,
        amountKobo: verified.amountKobo.toString(),
        currency: verified.currency,
        paidAt: verified.paidAt?.toISOString() ?? null,
        providerFeeKobo: verified.providerFeeKobo?.toString() ?? null,
        method: verified.method,
      };
      const eventMatchesProvider =
        !signatureVerified ||
        (event.reference === verified.reference &&
          event.gatewayTransactionId === verified.gatewayTransactionId &&
          event.amountKobo === verified.amountKobo &&
          event.currency === verified.currency);
      const record = await this.database.paymentWebhookEvent.create({
        data: {
          paymentAttemptId: attempt.id,
          provider: "MONNIFY",
          providerEventId: event.providerEventId,
          deduplicationKey,
          eventType: event.eventType,
          payloadSha256,
          ...(signatureVerified ? { signatureVerifiedAt: now } : {}),
          providerVerifiedAt: now,
          redactedPayload: payload,
        },
      });
      if (!eventMatchesProvider) {
        await this.database.$transaction(async (tx) => {
          await tx.payment.updateMany({
            where: { id: attempt.paymentId, status: { not: "SUCCEEDED" } },
            data: { status: "REQUIRES_REVIEW" },
          });
          await tx.paymentAnomaly.create({
            data: {
              paymentId: attempt.paymentId,
              paymentAttemptId: attempt.id,
              type: "OTHER",
              summary: "Monnify webhook facts differed from provider verification",
            },
          });
          await tx.paymentWebhookEvent.update({
            where: { id: record.id },
            data: { status: "PROCESSED", processedAt: now },
          });
        });
        return { accepted: true, duplicate: false };
      }
      await this.retryMonnifyWebhook(record.id, context);
      return { accepted: true, duplicate: false };
    }

    const refund = await this.database.refund.findUnique({
      where: { providerRefundId: event.refundReference },
      include: { paymentAttempt: true },
    });
    if (!refund || refund.paymentAttempt.provider !== "MONNIFY") {
      if (!signatureVerified) return { accepted: true, duplicate: false, ignored: true };
      await this.database.paymentWebhookEvent.create({
        data: {
          provider: "MONNIFY",
          providerEventId: event.providerEventId,
          deduplicationKey,
          eventType: event.eventType,
          payloadSha256,
          signatureVerifiedAt: now,
          status: "PROCESSED",
          processedAt: now,
          redactedPayload: { kind: "ignored", reason: "unknown-refund" },
        },
      });
      return { accepted: true, duplicate: false, ignored: true };
    }
    const adapter = this.providers.get("MONNIFY");
    const verified = adapter.verifyRefund
      ? await adapter.verifyRefund(event.refundReference)
      : null;
    if (!verified && !signatureVerified) throw paymentVerificationFailed();
    const amountKobo =
      verified?.amountKobo ?? (signatureVerified ? event.amountKobo : null);
    const currency = verified?.currency ?? (signatureVerified ? event.currency : null);
    const status =
      verified?.status ??
      (event.eventType === "SUCCESSFUL_REFUND" ? "succeeded" : "failed");
    const record = await this.database.paymentWebhookEvent.create({
      data: {
        refundId: refund.id,
        provider: "MONNIFY",
        providerEventId: event.providerEventId,
        deduplicationKey,
        eventType: event.eventType,
        payloadSha256,
        ...(signatureVerified ? { signatureVerifiedAt: now } : {}),
        providerVerifiedAt: verified ? now : null,
        redactedPayload: {
          kind: "refund",
          providerRefundId: verified?.providerRefundId ?? event.refundReference,
          status,
          amountKobo: amountKobo?.toString() ?? null,
          currency,
        },
      },
    });
    await this.retryMonnifyWebhook(record.id, context);
    return { accepted: true, duplicate: false };
  }

  async retryMonnifyWebhook(id: string, context: RequestSecurityContext): Promise<void> {
    const record = await this.database.paymentWebhookEvent.findUnique({
      where: { id },
      select: {
        provider: true,
        status: true,
        deduplicationKey: true,
        paymentAttemptId: true,
        refundId: true,
        redactedPayload: true,
      },
    });
    if (!record || record.provider !== "MONNIFY" || record.status === "PROCESSED") return;
    if (record.paymentAttemptId) {
      const payload = monnifyTransactionRetrySchema.parse(record.redactedPayload);
      await this.applyVerifiedAttempt(
        record.paymentAttemptId,
        {
          reference: payload.reference,
          gatewayTransactionId: payload.gatewayTransactionId,
          status: payload.status,
          amountKobo: BigInt(payload.amountKobo),
          currency: payload.currency,
          paidAt: payload.paidAt ? new Date(payload.paidAt) : null,
          providerFeeKobo:
            payload.providerFeeKobo === null ? null : BigInt(payload.providerFeeKobo),
          method: payload.method,
        },
        context,
        null,
        { provider: "MONNIFY", deduplicationKey: record.deduplicationKey },
      );
      return;
    }
    if (record.refundId) {
      const payload = monnifyRefundRetrySchema.parse(record.redactedPayload);
      await this.applyMonnifyRefund(record.refundId, record.deduplicationKey, payload);
      return;
    }
    await this.database.paymentWebhookEvent.update({
      where: { id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  }

  private async applyMonnifyRefund(
    refundId: string,
    webhookKey: string,
    result: z.infer<typeof monnifyRefundRetrySchema>,
  ): Promise<void> {
    await this.database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${refundId}::uuid FOR UPDATE`;
      const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
      const now = new Date();
      const exact =
        result.providerRefundId === refund.providerRefundId &&
        result.amountKobo !== null &&
        BigInt(result.amountKobo) === refund.amountKobo &&
        result.currency === refund.currency;
      if (!exact) {
        await tx.refund.update({
          where: { id: refundId },
          data: { status: "NEEDS_ATTENTION", providerStatus: result.status },
        });
        await tx.paymentAnomaly.create({
          data: {
            refundId,
            paymentAttemptId: refund.paymentAttemptId,
            type: "REFUND_MISMATCH",
            summary: "Monnify refund did not match the approved refund",
          },
        });
      } else if (result.status === "succeeded" && refund.status !== "SUCCEEDED") {
        await tx.refund.update({
          where: { id: refundId },
          data: { status: "SUCCEEDED", processedAt: now, providerStatus: result.status },
        });
        await tx.paymentLedgerEntry.upsert({
          where: { sourceKey: `refund:${refundId}` },
          create: {
            refundId,
            sourceKey: `refund:${refundId}`,
            type: "REFUND",
            direction: "DEBIT",
            amountKobo: refund.amountKobo,
            currency: refund.currency,
            occurredAt: now,
          },
          update: {},
        });
      } else if (result.status === "failed") {
        await tx.refund.updateMany({
          where: { id: refundId, status: { not: "SUCCEEDED" } },
          data: { status: "FAILED", failedAt: now, providerStatus: result.status },
        });
      }
      await tx.paymentWebhookEvent.update({
        where: {
          provider_deduplicationKey: {
            provider: "MONNIFY",
            deduplicationKey: webhookKey,
          },
        },
        data: {
          status: "PROCESSED",
          processedAt: now,
          processingAttempts: { increment: 1 },
        },
      });
    });
  }

  private async applyRefundWebhook(event: PaystackWebhookEvent, webhookKey: string) {
    await this.database.$transaction(async (tx) => {
      const refund = event.resourceId
        ? await tx.refund.findUnique({
            where: { providerRefundId: event.resourceId },
            include: { paymentAttempt: true },
          })
        : null;
      const now = new Date();
      if (!refund) {
        await tx.paymentWebhookEvent.update({
          where: {
            provider_deduplicationKey: {
              provider: "PAYSTACK",
              deduplicationKey: webhookKey,
            },
          },
          data: { status: "PROCESSED", processedAt: now },
        });
        return;
      }
      const exact =
        event.amountKobo === refund.amountKobo && event.currency === refund.currency;
      if (!exact) {
        await tx.refund.update({
          where: { id: refund.id },
          data: { status: "NEEDS_ATTENTION", providerStatus: event.status },
        });
        await tx.paymentAnomaly.create({
          data: {
            refundId: refund.id,
            paymentAttemptId: refund.paymentAttemptId,
            type: "REFUND_MISMATCH",
            summary: "Provider refund did not match the approved refund",
            details: {
              expectedAmountKobo: refund.amountKobo.toString(),
              receivedAmountKobo: event.amountKobo?.toString() ?? null,
              expectedCurrency: refund.currency,
              receivedCurrency: event.currency,
            },
          },
        });
      } else if (
        event.eventType === "refund.processed" ||
        event.status?.toLowerCase() === "processed"
      ) {
        if (refund.status !== "SUCCEEDED") {
          await tx.refund.update({
            where: { id: refund.id },
            data: { status: "SUCCEEDED", processedAt: now, providerStatus: event.status },
          });
          await tx.paymentLedgerEntry.create({
            data: {
              refundId: refund.id,
              sourceKey: `refund:${refund.id}`,
              type: "REFUND",
              direction: "DEBIT",
              amountKobo: refund.amountKobo,
              currency: refund.currency,
              occurredAt: now,
            },
          });
        }
      } else if (
        ["refund.failed", "failed"].includes(event.eventType) ||
        event.status?.toLowerCase() === "failed"
      ) {
        await tx.refund.updateMany({
          where: { id: refund.id, status: { not: "SUCCEEDED" } },
          data: { status: "FAILED", failedAt: now, providerStatus: event.status },
        });
      }
      await tx.paymentWebhookEvent.update({
        where: {
          provider_deduplicationKey: {
            provider: "PAYSTACK",
            deduplicationKey: webhookKey,
          },
        },
        data: {
          refundId: refund.id,
          status: "PROCESSED",
          processedAt: now,
          processingAttempts: { increment: 1 },
        },
      });
    });
  }

  private async applyDisputeWebhook(
    event: PaystackWebhookEvent,
    webhookKey: string,
    context: RequestSecurityContext,
  ) {
    await this.database.$transaction(async (tx) => {
      const attempt = event.reference
        ? await tx.paymentAttempt.findUnique({
            where: { internalReference: event.reference },
          })
        : null;
      const now = new Date();
      if (!attempt || !event.resourceId || event.amountKobo === null || !event.currency) {
        await tx.paymentWebhookEvent.update({
          where: {
            provider_deduplicationKey: {
              provider: "PAYSTACK",
              deduplicationKey: webhookKey,
            },
          },
          data: { status: "PROCESSED", processedAt: now },
        });
        return;
      }
      const rawStatus =
        event.status?.toUpperCase().replaceAll(" ", "_") ?? "AWAITING_RESPONSE";
      const status =
        (
          [
            "AWAITING_RESPONSE",
            "UNDER_REVIEW",
            "WON",
            "LOST",
            "ACCEPTED",
            "EXPIRED",
          ] as const
        ).find((value) => value === rawStatus) ?? "UNDER_REVIEW";
      const rawCategory = event.category?.toUpperCase().replaceAll(" ", "_") ?? "OTHER";
      const category =
        (
          [
            "NOT_RECOGNIZED",
            "FRAUD",
            "NOT_RECEIVED",
            "NOT_AS_DESCRIBED",
            "DUPLICATE_CHARGE",
            "REFUND_NOT_RECEIVED",
            "OTHER",
          ] as const
        ).find((value) => value === rawCategory) ?? "OTHER";
      const terminal = ["WON", "LOST", "ACCEPTED", "EXPIRED"].includes(status);
      const providerDisputeId = event.resourceId;
      const dispute = await tx.paymentDispute.upsert({
        where: {
          provider_providerDisputeId: { provider: "PAYSTACK", providerDisputeId },
        },
        create: {
          paymentAttemptId: attempt.id,
          provider: "PAYSTACK",
          providerDisputeId,
          status,
          category,
          amountKobo: event.amountKobo,
          currency: event.currency,
          openedAt: now,
          responseDueAt: event.responseDueAt,
          ...(terminal ? { resolvedAt: now } : {}),
        },
        update: {
          status,
          responseDueAt: event.responseDueAt,
          ...(terminal ? { resolvedAt: now } : {}),
        },
      });
      if (
        !terminal &&
        (event.amountKobo !== attempt.amountKobo || event.currency !== attempt.currency)
      )
        await tx.paymentAnomaly.create({
          data: {
            paymentAttemptId: attempt.id,
            disputeId: dispute.id,
            type: "OTHER",
            summary: "Dispute amount or currency differs from the captured attempt",
          },
        });
      if (["LOST", "ACCEPTED"].includes(status))
        await tx.paymentLedgerEntry.upsert({
          where: { sourceKey: `chargeback:${dispute.id}` },
          create: {
            disputeId: dispute.id,
            sourceKey: `chargeback:${dispute.id}`,
            type: "CHARGEBACK",
            direction: "DEBIT",
            amountKobo: dispute.amountKobo,
            currency: dispute.currency,
            occurredAt: now,
          },
          update: {},
        });
      await tx.paymentWebhookEvent.update({
        where: {
          provider_deduplicationKey: {
            provider: "PAYSTACK",
            deduplicationKey: webhookKey,
          },
        },
        data: {
          disputeId: dispute.id,
          status: "PROCESSED",
          processedAt: now,
          processingAttempts: { increment: 1 },
        },
      });
      await appendAuditEvent(tx, {
        actorUserId: null,
        action: "DISPUTE_UPDATED",
        entityType: "DISPUTE",
        entityId: dispute.id,
        newValues: { status },
        context,
      });
    });
  }

  private async applyVerifiedAttempt(
    attemptId: string,
    result: VerifiedPayment,
    context: RequestSecurityContext,
    actorUserId: string | null,
    webhook?: { provider: OnlinePaymentProvider; deduplicationKey: string },
  ) {
    await this.database.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${attemptId}::uuid FOR UPDATE`;
      if (!rows.length) throw paymentNotFound();
      const attempt = await tx.paymentAttempt.findUnique({
        where: { id: attemptId },
        include: { payment: true },
      });
      if (!attempt) throw paymentNotFound();
      const now = new Date();
      const exact =
        result.reference === attempt.internalReference &&
        result.amountKobo === attempt.amountKobo &&
        result.currency === attempt.currency;
      if (result.status !== "success") {
        await tx.paymentAttempt.updateMany({
          where: { id: attemptId, status: { not: "SUCCESSFUL" } },
          data: {
            status:
              result.status === "abandoned"
                ? "ABANDONED"
                : result.status === "failed"
                  ? "FAILED"
                  : "PENDING",
            gatewayStatus: result.status,
            ...(result.status === "failed" ? { failedAt: now } : {}),
            ...(result.status === "abandoned" ? { abandonedAt: now } : {}),
          },
        });
      } else if (!exact) {
        await tx.paymentAttempt.update({
          where: { id: attemptId },
          data: {
            status: "SUCCESSFUL",
            verificationStatus: "MISMATCH",
            verifiedAmountKobo: result.amountKobo,
            verifiedCurrency: result.currency,
            gatewayTransactionId: result.gatewayTransactionId,
            gatewayStatus: result.status,
            paidAt: result.paidAt ?? now,
            verifiedAt: now,
          },
        });
        await tx.payment.updateMany({
          where: { id: attempt.paymentId, status: { not: "SUCCEEDED" } },
          data: { status: "REQUIRES_REVIEW" },
        });
        await tx.paymentAnomaly.create({
          data: {
            paymentId: attempt.paymentId,
            paymentAttemptId: attemptId,
            type:
              result.currency !== attempt.currency
                ? "CURRENCY_MISMATCH"
                : "AMOUNT_MISMATCH",
            summary: "Provider verification did not match the server-owned payment",
            details: {
              expectedAmountKobo: attempt.amountKobo.toString(),
              receivedAmountKobo: result.amountKobo.toString(),
              expectedCurrency: attempt.currency,
              receivedCurrency: result.currency,
            },
          },
        });
      } else if (attempt.status !== "SUCCESSFUL") {
        await tx.paymentAttempt.update({
          where: { id: attemptId },
          data: {
            status: "SUCCESSFUL",
            verificationStatus: "VERIFIED",
            verifiedAmountKobo: result.amountKobo,
            verifiedCurrency: result.currency,
            providerReference: result.reference,
            gatewayTransactionId: result.gatewayTransactionId,
            providerFeeKobo: result.providerFeeKobo,
            gatewayStatus: result.status,
            ...(result.method ? { method: methodMap[result.method] ?? "OTHER" } : {}),
            paidAt: result.paidAt ?? now,
            verifiedAt: now,
          },
        });
        if (attempt.payment.status === "SUCCEEDED") {
          await tx.paymentAnomaly.create({
            data: {
              paymentId: attempt.paymentId,
              paymentAttemptId: attemptId,
              type: "DUPLICATE_SUCCESS",
              summary:
                "An additional successful charge was received for a settled payment",
            },
          });
        } else await this.settle(tx, attempt.paymentId, attemptId, result.paidAt ?? now);
      }
      if (webhook)
        await tx.paymentWebhookEvent.update({
          where: {
            provider_deduplicationKey: {
              provider: webhook.provider,
              deduplicationKey: webhook.deduplicationKey,
            },
          },
          data: {
            paymentAttemptId: attemptId,
            status: "PROCESSED",
            processedAt: now,
            processingAttempts: { increment: 1 },
          },
        });
      await appendAuditEvent(tx, {
        actorUserId,
        action: "PAYMENT_VERIFIED",
        entityType: "PAYMENT_ATTEMPT",
        entityId: attemptId,
        newValues: { matched: exact, providerStatus: result.status },
        context,
      });
    });
  }

  private async settle(
    tx: Prisma.TransactionClient,
    paymentId: string,
    attemptId: string,
    occurredAt: Date,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId}::uuid FOR UPDATE`;
    const existingPayment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { status: true, settledAttemptId: true },
    });
    if (existingPayment.status === "SUCCEEDED") {
      if (existingPayment.settledAttemptId !== attemptId)
        throw paymentConflict("Payment was already settled by another attempt");
      return;
    }
    const payment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "SUCCEEDED",
        settledAttemptId: attemptId,
        succeededAt: occurredAt,
        cancelledAt: null,
        expiredAt: null,
      },
      select: {
        id: true,
        orderId: true,
        invoiceId: true,
        vehicleTransactionId: true,
        bookingId: true,
        amountKobo: true,
        currency: true,
      },
    });
    await tx.paymentLedgerEntry.upsert({
      where: { sourceKey: `capture:${attemptId}` },
      create: {
        paymentAttemptId: attemptId,
        sourceKey: `capture:${attemptId}`,
        type: "CAPTURE",
        direction: "CREDIT",
        amountKobo: (
          await tx.paymentAttempt.findUniqueOrThrow({
            where: { id: attemptId },
            select: { amountKobo: true },
          })
        ).amountKobo,
        currency: "NGN",
        occurredAt,
      },
      update: {},
    });
    if (payment.bookingId) {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${payment.bookingId}::uuid FOR UPDATE`;
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: payment.bookingId },
        select: {
          id: true,
          customerId: true,
          status: true,
          paymentHoldExpiresAt: true,
          scheduledAt: true,
          scheduleVersion: true,
          depositAmountKobo: true,
          customer: { select: { userId: true } },
        },
      });
      const eligible =
        booking.status === "AWAITING_DEPOSIT" &&
        booking.paymentHoldExpiresAt !== null &&
        occurredAt <= booking.paymentHoldExpiresAt;
      if (!eligible) {
        await tx.paymentAnomaly.create({
          data: {
            paymentId: payment.id,
            paymentAttemptId: attemptId,
            type: "LATE_SUCCESS",
            summary: "Deposit was captured after the booking slot hold ended",
            details: {
              payableType: "BOOKING",
              payableId: booking.id,
              bookingStatus: booking.status,
              amountKobo: payment.amountKobo.toString(),
              currency: payment.currency,
            },
          },
        });
        await enqueueNotification(tx, {
          userId: booking.customer.userId,
          type: "PAYMENT",
          category: "TRANSACTIONAL",
          title: "Deposit received after slot release",
          message:
            "Your deposit arrived after the booking hold ended, so the slot was not reclaimed. Our team will review the payment for a refund or transfer.",
          resourceType: "BOOKING",
          resourceId: booking.id,
          deduplicationKey: `booking:${booking.id}:late-deposit:${attemptId}`,
          channels: ["EMAIL"],
        });
        return;
      }
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: occurredAt,
          depositPaidAt: occurredAt,
          version: { increment: 1 },
        },
        select: { id: true, scheduledAt: true, scheduleVersion: true },
      });
      await scheduleReminders(tx, updated);
      await enqueueNotification(tx, {
        userId: booking.customer.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: "Booking confirmed",
        message: `Your 30% non-refundable deposit was verified and your appointment for ${booking.scheduledAt.toISOString()} is confirmed. The retained deposit will be credited to your final service balance.`,
        resourceType: "BOOKING",
        resourceId: booking.id,
        deduplicationKey: `booking:${booking.id}:confirmed`,
        channels: ["EMAIL"],
      });
      return;
    }
    if (payment.orderId) {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        select: {
          status: true,
          paymentDueAt: true,
          invoice: { select: { id: true, status: true } },
        },
      });
      if (
        order.status === "CANCELLED" ||
        (order.paymentDueAt !== null && occurredAt > order.paymentDueAt)
      ) {
        await tx.paymentAnomaly.create({
          data: {
            paymentId: payment.id,
            paymentAttemptId: attemptId,
            type: "LATE_SUCCESS",
            summary: "Payment was captured after the order commitment window ended",
            details: {
              payableType: "ORDER",
              payableId: payment.orderId,
              orderStatus: order.status,
              amountKobo: payment.amountKobo.toString(),
              currency: payment.currency,
            },
          },
        });
        return;
      }
      await tx.order.update({
        where: { id: payment.orderId },
        data: { paidAt: occurredAt },
      });
      if (
        order.invoice &&
        order.invoice.status !== "PAID" &&
        order.invoice.status !== "VOID"
      )
        await tx.invoice.update({
          where: { id: order.invoice.id },
          data: {
            status: "PAID",
            issuedAt: occurredAt,
            paidAt: occurredAt,
            version: { increment: 1 },
          },
        });
    }
    if (payment.invoiceId)
      await tx.invoice.updateMany({
        where: { id: payment.invoiceId, status: "ISSUED" },
        data: { status: "PAID", paidAt: occurredAt, version: { increment: 1 } },
      });
    if (payment.vehicleTransactionId) {
      const vehicle = await tx.vehicleTransaction.findUnique({
        where: { id: payment.vehicleTransactionId },
        select: { status: true, agreedPriceKobo: true, reservationExpiresAt: true },
      });
      if (
        vehicle !== null &&
        (vehicle.status === "CANCELLED" ||
          vehicle.status === "EXPIRED" ||
          (vehicle.reservationExpiresAt !== null &&
            occurredAt > vehicle.reservationExpiresAt))
      ) {
        await tx.paymentAnomaly.create({
          data: {
            paymentId: payment.id,
            paymentAttemptId: attemptId,
            type: "LATE_SUCCESS",
            summary: "Payment was captured after the vehicle commitment window ended",
            details: {
              payableType: "VEHICLE_TRANSACTION",
              payableId: payment.vehicleTransactionId,
              transactionStatus: vehicle.status,
              amountKobo: payment.amountKobo.toString(),
              currency: payment.currency,
            },
          },
        });
        return;
      }
      if (vehicle?.agreedPriceKobo) {
        const total =
          (
            await tx.payment.aggregate({
              where: {
                vehicleTransactionId: payment.vehicleTransactionId,
                status: "SUCCEEDED",
              },
              _sum: { amountKobo: true },
            })
          )._sum.amountKobo ?? 0n;
        const target = total >= vehicle.agreedPriceKobo ? "PAID" : "PARTIALLY_PAID";
        if (vehicle.status !== target) {
          await tx.vehicleTransaction.update({
            where: { id: payment.vehicleTransactionId },
            data: {
              status: target,
              ...(target === "PAID" ? { paidAt: occurredAt } : {}),
              version: { increment: 1 },
            },
          });
          await tx.vehicleTransactionStatusHistory.create({
            data: {
              vehicleTransactionId: payment.vehicleTransactionId,
              fromStatus: vehicle.status,
              toStatus: target,
            },
          });
        }
      }
    }
  }

  private assertPayable(payment: { status: string; expiresAt: Date | null }) {
    if (["SUCCEEDED", "CANCELLED", "EXPIRED"].includes(payment.status))
      throw paymentConflict("Payment is no longer payable");
    if (payment.expiresAt && payment.expiresAt <= new Date())
      throw paymentConflict("Payment has expired");
  }

  private readEvidence(ticket: string, actorUserId: string, paymentId: string) {
    try {
      const evidence = readPaymentEvidenceTicket(ticket);
      if (
        evidence.actorUserId !== actorUserId ||
        evidence.paymentId !== paymentId ||
        evidence.expiresAt <= Date.now()
      )
        throw new Error("Evidence ticket mismatch");
      return evidence;
    } catch {
      throw paymentConflict("Payment evidence token is invalid or expired");
    }
  }

  private async allowedBranch(
    actor: AuthenticatedActor,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    if (actor.role !== "STAFF") return null;
    const staff = await this.repository.staffProfile(actor.userId, client);
    if (!staff?.branchId || staff.branch?.isActive !== true) throw paymentNotFound();
    return staff.branchId;
  }

  private async assertBranch(
    actor: AuthenticatedActor,
    paymentId: string,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    const allowed = await this.allowedBranch(actor, client);
    if (allowed === null) return;
    const source = await this.repository.paymentBranch(paymentId, client);
    const branch =
      source?.order?.branchId ??
      source?.invoice?.order?.branchId ??
      source?.invoice?.booking?.branchId ??
      source?.invoice?.vehicleTransaction?.vehicleListing.branchId ??
      source?.vehicleTransaction?.vehicleListing.branchId ??
      source?.booking?.branchId ??
      null;
    if (branch !== allowed) throw paymentNotFound();
  }

  private async resolveSource(
    customerId: string,
    input: PaymentCreateInput,
    tx: Prisma.TransactionClient,
  ): Promise<{ amountKobo: bigint; expiresAt: Date | null }> {
    if (input.targetType === "ORDER") {
      const source = await this.repository.order(input.targetId, customerId, tx);
      if (
        !source ||
        source.currency !== "NGN" ||
        !["PENDING", "CONFIRMED"].includes(source.status)
      )
        throw paymentNotFound();
      return { amountKobo: source.totalKobo, expiresAt: source.paymentDueAt };
    }
    if (input.targetType === "INVOICE") {
      const source = await this.repository.invoice(input.targetId, customerId, tx);
      if (
        !source ||
        source.currency !== "NGN" ||
        source.status !== "ISSUED" ||
        source.bookingId === null
      )
        throw paymentNotFound();
      return { amountKobo: source.totalKobo, expiresAt: source.dueAt };
    }
    const source = await this.repository.vehicleTransaction(
      input.targetId,
      customerId,
      tx,
    );
    if (
      !source ||
      source.currency !== "NGN" ||
      source.agreedPriceKobo === null ||
      ["CANCELLED", "EXPIRED", "COMPLETED"].includes(source.status)
    )
      throw paymentNotFound();
    const paid =
      (await this.repository.settledVehicleAmount(source.id, tx))._sum.amountKobo ?? 0n;
    const remaining = source.agreedPriceKobo - paid;
    if (remaining <= 0n) throw paymentConflict("Vehicle transaction is fully paid");
    if (input.purpose === "VEHICLE_FULL_PAYMENT" && paid !== 0n)
      throw paymentConflict("Full payment is unavailable after a partial payment");
    const amountKobo =
      input.purpose === "VEHICLE_RESERVATION" ||
      input.purpose === "VEHICLE_PARTIAL_PAYMENT"
        ? source.reservationRequiredKobo
        : remaining;
    if (amountKobo === null || amountKobo <= 0n || amountKobo > remaining)
      throw paymentConflict("A server-approved payment amount is not available");
    return { amountKobo, expiresAt: source.reservationExpiresAt };
  }
}

export const paymentsService = new PaymentsService();
