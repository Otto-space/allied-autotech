import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import { createApp } from "../../src/app.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { objectStorage } from "../../src/providers/storage/s3-object-storage.adapter.js";
import { refundQueueRecordSchema } from "../../src/modules/payments/refund-record.js";
import { testCapability } from "../helpers/owner-policy.js";
import { sessionWindow } from "../helpers/session-window.js";

const app = createApp({ checkReadiness: async () => undefined });
async function account(role: "CUSTOMER" | "STAFF" | "ADMIN" = "STAFF", assured = true) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-isolated-test",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Synthetic",
                lastName: "Refund",
                phone: "+2348000000000",
              },
            },
          }
        : { staffProfile: { create: { firstName: "Synthetic", lastName: "Refund" } } }),
    },
    include: { profile: true },
  });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      createdAt: new Date(Date.now() - 1000),
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      ...sessionWindow(3600000),
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role !== "CUSTOMER" && assured ? new Date() : null,
    },
  });
  return {
    user,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrf,
    },
  };
}
type Account = Awaited<ReturnType<typeof account>>;
const post = (actor: Account, path: string, body: unknown) =>
  request(app).post(`/api/v1/staff/refunds/${path}`).set(actor.headers).send(body);
const get = (actor: Account, query = "") =>
  request(app).get(`/api/v1/staff/refunds${query}`).set(actor.headers);
async function fixture(provider: "MANUAL" | "PAYSTACK" = "MANUAL") {
  const customer = await account("CUSTOMER"),
    requester = await account("ADMIN");
  const branch = await prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 8),
      name: "Synthetic refunds",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const order = await prisma.order.create({
    data: {
      branchId: branch.id,
      customerId: customer.user.profile!.id,
      orderNumber: randomUUID(),
      customerName: "Synthetic customer",
      customerEmail: customer.user.email,
      customerPhone: "+2348000000000",
      subtotalKobo: 100000n,
      totalKobo: 100000n,
    },
  });
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      customerId: customer.user.profile!.id,
      paymentNumber: randomUUID(),
      purpose: "ORDER_PAYMENT",
      amountKobo: 100000n,
      idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
    },
  });
  const attempt = await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      internalReference: randomUUID(),
      provider,
      amountKobo: 100000n,
      status: "SUCCESSFUL",
      verificationStatus: "VERIFIED",
      verifiedAmountKobo: 100000n,
      verifiedCurrency: "NGN",
      paidAt: new Date(),
      verifiedAt: new Date(),
      createdAt: new Date(Date.now() - 1000),
      initiatedAt: new Date(Date.now() - 1000),
    },
  });
  const refund = await prisma.refund.create({
    data: {
      paymentAttemptId: attempt.id,
      requestedByUserId: requester.user.id,
      refundNumber: randomUUID(),
      idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
      amountKobo: 20000n,
      reason: "Synthetic refund for isolated verification",
    },
  });
  return { customer, requester, order, payment, attempt, refund };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Delegated refund processing",
  () => {
    afterEach(() => vi.restoreAllMocks());
    afterAll(() => prisma.$disconnect());
    it(
      "limits queue discovery by active grant and stage, validates paging, and excludes private evidence",
      { timeout: 30000 },
      async () => {
        const f = await fixture(),
          approver = await account(),
          transfer = await account(),
          checker = await account();
        expect((await request(app).get("/api/v1/staff/refunds")).status).toBe(401);
        for (const actor of [f.customer, approver, f.requester])
          expect((await get(actor)).status).toBe(403);
        const unassured = await account("STAFF", false);
        await testCapability(unassured.user.id, "REFUND_APPROVE");
        expect((await get(unassured)).status).toBe(403);
        await testCapability(approver.user.id, "REFUND_APPROVE");
        await testCapability(transfer.user.id, "REFUND_TRANSFER");
        await testCapability(checker.user.id, "REFUND_CHECK");
        for (const query of [
          "?limit=0",
          "?cursor=invalid",
          "?status=UNKNOWN",
          "?secret=true",
        ])
          expect((await get(approver, query)).status).toBe(422);
        const list = await get(approver, "?limit=1&status=REQUESTED");
        expect(list.status).toBe(200);
        expect(list.body.data.items).toHaveLength(1);
        expect(
          refundQueueRecordSchema.strict().safeParse(list.body.data.items[0]).success,
        ).toBe(true);
        expect(list.body.data.items[0].id).toBe(f.refund.id);
        const ownTransfer = await get(transfer);
        expect(
          ownTransfer.body.data.items.some((r: { id: string }) => r.id === f.refund.id),
        ).toBe(false);
        const ownChecker = await get(checker);
        expect(
          ownChecker.body.data.items.some((r: { id: string }) => r.id === f.refund.id),
        ).toBe(false);
        const approved = await post(approver, `${f.refund.id}/decision`, {
          decision: "APPROVED",
        });
        expect(approved.status).toBe(200);
        expect(approved.body.data.status).toBe("NEEDS_ATTENTION");
        expect(
          refundQueueRecordSchema.strict().safeParse(approved.body.data).success,
        ).toBe(true);
        const transfers = await get(transfer);
        expect(
          transfers.body.data.items.some((r: { id: string }) => r.id === f.refund.id),
        ).toBe(true);
        const approvals = await get(approver, "?status=NEEDS_ATTENTION");
        expect(
          approvals.body.data.items.some((r: { id: string }) => r.id === f.refund.id),
        ).toBe(true);
        await prisma.userCapability.updateMany({
          where: { userId: transfer.user.id },
          data: { revokedAt: new Date() },
        });
        expect((await get(transfer)).status).toBe(403);
        expect(
          await prisma.auditLog.count({
            where: { userId: approver.user.id, action: "READ", entityType: "REFUND" },
          }),
        ).toBeGreaterThan(0);
      },
    );
    it(
      "requires separate approval, transfer and checking with private verified evidence and one ledger entry",
      { timeout: 30000 },
      async () => {
        const f = await fixture(),
          approver = await account(),
          transfer = await account(),
          checker = await account();
        await testCapability(f.requester.user.id, "REFUND_APPROVE");
        await testCapability(approver.user.id, "REFUND_APPROVE");
        await testCapability(transfer.user.id, "REFUND_TRANSFER");
        await testCapability(checker.user.id, "REFUND_CHECK");
        expect(
          (await post(f.requester, `${f.refund.id}/decision`, { decision: "APPROVED" }))
            .status,
        ).toBe(409);
        expect(
          (
            await post(
              { ...approver, headers: { ...approver.headers, "X-CSRF-Token": "wrong" } },
              `${f.refund.id}/decision`,
              { decision: "APPROVED" },
            )
          ).status,
        ).toBe(403);
        expect(
          (await post(approver, `${f.refund.id}/decision`, { decision: "APPROVED" }))
            .status,
        ).toBe(200);
        const checked = {
          accepted: true,
          note: "Synthetic independently checked transfer and recipient",
          evidenceChecked: true,
        };
        expect((await post(checker, `${f.refund.id}/check`, checked)).status).toBe(409);
        const uploadMock = vi.spyOn(objectStorage, "createUpload").mockResolvedValue({
          method: "PUT",
          url: "https://private.example.test/upload",
          expiresAt: new Date(Date.now() + 60000),
          headers: {},
        });
        const verify = vi.spyOn(objectStorage, "verifyObject").mockResolvedValue(false);
        vi.spyOn(objectStorage, "createDownload").mockResolvedValue(
          "https://private.example.test/evidence",
        );
        const metadata = {
          mimeType: "application/pdf",
          sizeBytes: 20,
          checksumSha256: "a".repeat(64),
        };
        expect(
          (
            await post(transfer, `${f.refund.id}/evidence-upload`, {
              ...metadata,
              sizeBytes: 0,
            })
          ).status,
        ).toBe(422);
        const upload = await post(transfer, `${f.refund.id}/evidence-upload`, metadata);
        expect(upload.status).toBe(200);
        expect(uploadMock).toHaveBeenCalledTimes(1);
        const body = {
          bankReference: `SYNTHETIC-${randomUUID()}`,
          transferredAt: new Date().toISOString(),
          evidenceToken: upload.body.data.evidenceToken,
          beneficiary: {
            bankName: "Synthetic bank",
            accountName: "Synthetic customer",
            accountNumber: "0123456789",
          },
        };
        expect((await post(transfer, `${f.refund.id}/transfer`, body)).status).toBe(409);
        verify.mockResolvedValue(true);
        const saved = await post(transfer, `${f.refund.id}/transfer`, body);
        expect(saved.status, JSON.stringify(saved.body)).toBe(200);
        expect(saved.body.data).toMatchObject({
          id: f.refund.id,
          status: "PROCESSING",
          transferredAt: body.transferredAt,
          transferredByUserId: transfer.user.id,
          bankReference: body.bankReference,
        });
        expect(JSON.stringify(saved.body.data)).not.toContain(
          body.beneficiary.accountNumber,
        );
        expect((await post(transfer, `${f.refund.id}/transfer`, body)).status).toBe(200);
        expect(
          (
            await post(transfer, `${f.refund.id}/transfer`, {
              ...body,
              beneficiary: { ...body.beneficiary, accountNumber: "9876543210" },
            })
          ).status,
        ).toBe(409);
        const replacement = await post(
          transfer,
          `${f.refund.id}/evidence-upload`,
          metadata,
        );
        expect(
          (
            await post(transfer, `${f.refund.id}/transfer`, {
              ...body,
              evidenceToken: replacement.body.data.evidenceToken,
            })
          ).status,
        ).toBe(409);
        const checkQueue = await get(checker);
        const item = checkQueue.body.data.items.find(
          (r: { id: string }) => r.id === f.refund.id,
        );
        expect(refundQueueRecordSchema.strict().safeParse(item).success).toBe(true);
        expect(JSON.stringify(item)).not.toContain(body.beneficiary.accountNumber);
        expect((await post(transfer, `${f.refund.id}/evidence-access`, {})).status).toBe(
          403,
        );
        const access = await post(checker, `${f.refund.id}/evidence-access`, {});
        expect(access.status).toBe(200);
        expect(access.body.data).toMatchObject({
          id: f.refund.id,
          amountKobo: "20000",
          beneficiary: body.beneficiary,
          bankReference: body.bankReference,
          transferredAt: body.transferredAt,
        });
        await testCapability(transfer.user.id, "REFUND_CHECK");
        expect((await post(transfer, `${f.refund.id}/check`, checked)).status).toBe(409);
        expect(
          (
            await post(checker, `${f.refund.id}/check`, {
              ...checked,
              evidenceChecked: false,
            })
          ).status,
        ).toBe(422);
        const results = await Promise.all([
          post(checker, `${f.refund.id}/check`, checked),
          post(checker, `${f.refund.id}/check`, checked),
        ]);
        for (const result of results)
          expect(result.body.data).toMatchObject({
            id: f.refund.id,
            status: "SUCCEEDED",
            checkedByUserId: checker.user.id,
          });
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { refundId: f.refund.id, type: "REFUND" },
          }),
        ).toBe(1);
        expect(await prisma.order.findUnique({ where: { id: f.order.id } })).toEqual(
          f.order,
        );
      },
    );
  },
);
