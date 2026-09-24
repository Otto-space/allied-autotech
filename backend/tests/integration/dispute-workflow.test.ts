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
import { disputeRecordSchema } from "../../src/modules/payments/disputes.schemas.js";
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
  request(app).post(`/api/v1/staff/disputes/${path}`).set(actor.headers).send(body);
const get = (actor: Account, query = "") =>
  request(app).get(`/api/v1/staff/disputes${query}`).set(actor.headers);
async function fixture(provider: "MANUAL" | "PAYSTACK" = "MANUAL") {
  const customer = await account("CUSTOMER"),
    requester = await account("ADMIN");
  const branch = await prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 8),
      name: "Synthetic disputes",
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
  const dispute = await prisma.paymentDispute.create({
    data: {
      paymentAttemptId: attempt.id,
      provider: "PAYSTACK",
      providerDisputeId: randomUUID(),
      status: "AWAITING_RESPONSE",
      category: "NOT_RECEIVED",
      amountKobo: 20000n,
      openedAt: new Date(Date.now() - 3600000),
      responseDueAt: new Date(Date.now() + 86400000),
    },
  });
  return { customer, requester, order, payment, attempt, dispute };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")("Dispute work queue", () => {
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => prisma.$disconnect());
  it(
    "limits delegated reads and validates actions while preserving oversight boundaries",
    { timeout: 30000 },
    async () => {
      const f = await fixture(),
        admin = await account("ADMIN"),
        staff = await account(),
        backup = await account(),
        other = await account(),
        unassured = await account("STAFF", false);
      for (const actor of [admin, staff, backup, other, unassured])
        await testCapability(actor.user.id, "DISPUTE_MANAGE");
      expect((await get(f.customer)).status).toBe(403);
      expect((await get(f.requester)).status).toBe(403);
      expect((await get(unassured)).status).toBe(403);
      expect((await get(admin, "?limit=0")).status).toBe(422);
      expect((await get(admin, "?cursor=bad")).status).toBe(422);
      expect(
        (
          await post(admin, `${f.dispute.id}/assign`, {
            primaryUserId: staff.user.id,
            backupUserId: staff.user.id,
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await post(
            { ...admin, headers: { ...admin.headers, "X-CSRF-Token": "wrong" } },
            `${f.dispute.id}/assign`,
            { primaryUserId: staff.user.id, backupUserId: backup.user.id },
          )
        ).status,
      ).toBe(403);
      const assigned = await post(admin, `${f.dispute.id}/assign`, {
        primaryUserId: staff.user.id,
        backupUserId: backup.user.id,
        expectedUpdatedAt: f.dispute.updatedAt.toISOString(),
      });
      expect(assigned.status).toBe(200);
      expect(disputeRecordSchema.strict().safeParse(assigned.body.data).success).toBe(
        true,
      );
      expect(assigned.body.data).toMatchObject({
        id: f.dispute.id,
        primaryUserId: staff.user.id,
        backupUserId: backup.user.id,
        hasEvidence: false,
      });
      expect(
        (
          await post(admin, `${f.dispute.id}/assign`, {
            primaryUserId: other.user.id,
            backupUserId: backup.user.id,
            expectedUpdatedAt: f.dispute.updatedAt.toISOString(),
          })
        ).status,
      ).toBe(409);
      const list = await get(staff);
      expect(list.body.data.items.map((r: { id: string }) => r.id)).toContain(
        f.dispute.id,
      );
      expect((await get(other)).body.data.items).toEqual([]);
      expect(
        (
          await post(other, `${f.dispute.id}/acknowledge`, {
            note: "Synthetic acknowledgement",
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await post(staff, `${f.dispute.id}/assign`, {
            primaryUserId: other.user.id,
            backupUserId: backup.user.id,
          })
        ).status,
      ).toBe(403);
      expect(
        (await post(staff, `${f.dispute.id}/acknowledge`, { note: "short" })).status,
      ).toBe(422);
      const ack = await post(staff, `${f.dispute.id}/acknowledge`, {
        note: "Synthetic acknowledgement",
        expectedUpdatedAt: assigned.body.data.updatedAt,
      });
      expect(ack.status).toBe(200);
      expect(ack.body.data.acknowledgedByUserId).toBe(staff.user.id);
      await prisma.userCapability.updateMany({
        where: { userId: staff.user.id, capability: "DISPUTE_MANAGE" },
        data: { revokedAt: new Date() },
      });
      expect((await get(staff)).status).toBe(403);
      expect(
        (
          await post(staff, `${f.dispute.id}/acknowledge`, {
            note: "Synthetic acknowledgement",
          })
        ).status,
      ).toBe(403);
      expect(
        (await get(backup)).body.data.items.map((r: { id: string }) => r.id),
      ).toContain(f.dispute.id);
    },
  );
  it(
    "preserves private evidence and exact provider receipts without resolving money",
    { timeout: 30000 },
    async () => {
      const f = await fixture(),
        admin = await account("ADMIN"),
        staff = await account(),
        other = await account();
      for (const actor of [admin, staff, other])
        await testCapability(actor.user.id, "DISPUTE_MANAGE");
      await prisma.paymentDispute.update({
        where: { id: f.dispute.id },
        data: { primaryUserId: staff.user.id, backupUserId: admin.user.id },
      });
      vi.spyOn(objectStorage, "createUpload").mockResolvedValue({
        method: "PUT",
        url: "https://storage.invalid/private",
        expiresAt: new Date(Date.now() + 60000),
        headers: {},
      });
      const verify = vi.spyOn(objectStorage, "verifyObject").mockResolvedValue(false);
      vi.spyOn(objectStorage, "createDownload").mockResolvedValue(
        "https://storage.invalid/evidence",
      );
      const metadata = {
        mimeType: "application/pdf",
        sizeBytes: 20,
        checksumSha256: "a".repeat(64),
      };
      expect(
        (
          await post(staff, `${f.dispute.id}/submission`, {
            providerSubmissionReference: "SYNTHETIC",
            submittedAt: new Date().toISOString(),
            note: "Synthetic dashboard submission",
          })
        ).status,
      ).toBe(409);
      const upload = await post(staff, `${f.dispute.id}/evidence-upload`, metadata);
      expect(upload.status).toBe(200);
      const body = {
        evidenceToken: upload.body.data.evidenceToken,
        invoice: true,
        fulfillmentOrHandoverProof: true,
        relevantCustomerMessages: true,
        note: "Synthetic complete evidence bundle",
      };
      expect(
        (await post(staff, `${f.dispute.id}/evidence`, { ...body, invoice: false }))
          .status,
      ).toBe(422);
      expect((await post(staff, `${f.dispute.id}/evidence`, body)).status).toBe(409);
      verify.mockResolvedValue(true);
      expect((await post(admin, `${f.dispute.id}/evidence`, body)).status).toBe(409);
      const saved = await post(staff, `${f.dispute.id}/evidence`, body);
      expect(saved.status).toBe(200);
      expect(saved.body.data.hasEvidence).toBe(true);
      expect(disputeRecordSchema.strict().safeParse(saved.body.data).success).toBe(true);
      expect((await post(staff, `${f.dispute.id}/evidence`, body)).status).toBe(409);
      expect(
        (await post(staff, `${f.dispute.id}/evidence-upload`, metadata)).status,
      ).toBe(409);
      expect((await post(other, `${f.dispute.id}/evidence-access`, {})).status).toBe(403);
      const access = await post(staff, `${f.dispute.id}/evidence-access`, {});
      expect(access.body.data).toEqual({
        id: f.dispute.id,
        url: "https://storage.invalid/evidence",
      });
      expect(JSON.stringify((await get(staff)).body.data)).not.toContain(
        "evidenceObjectKey",
      );
      const receipt = {
        providerSubmissionReference: "SYNTHETIC-RECEIPT",
        submittedAt: new Date().toISOString(),
        note: "Synthetic provider dashboard receipt",
      };
      const submitted = await post(staff, `${f.dispute.id}/submission`, receipt);
      expect(submitted.status).toBe(200);
      expect(submitted.body.data).toMatchObject({
        id: f.dispute.id,
        status: "AWAITING_RESPONSE",
        providerSubmissionReference: receipt.providerSubmissionReference,
        respondedAt: receipt.submittedAt,
        resolvedAt: null,
      });
      expect((await post(staff, `${f.dispute.id}/submission`, receipt)).status).toBe(200);
      expect(
        (
          await post(staff, `${f.dispute.id}/submission`, {
            ...receipt,
            submittedAt: new Date(Date.now() - 1000).toISOString(),
          })
        ).status,
      ).toBe(409);
      expect(
        await prisma.paymentLedgerEntry.count({ where: { disputeId: f.dispute.id } }),
      ).toBe(0);
      expect(await prisma.order.findUnique({ where: { id: f.order.id } })).toEqual(
        f.order,
      );
      await prisma.paymentDispute.update({
        where: { id: f.dispute.id },
        data: { status: "WON", resolvedAt: new Date() },
      });
      expect(
        (await get(staff)).body.data.items.map((r: { id: string }) => r.id),
      ).not.toContain(f.dispute.id);
      expect(
        (await get(staff, "?openOnly=false")).body.data.items.map(
          (r: { id: string }) => r.id,
        ),
      ).toContain(f.dispute.id);
      expect(
        (
          await post(staff, `${f.dispute.id}/acknowledge`, {
            note: "Synthetic acknowledgement",
          })
        ).status,
      ).toBe(409);
      expect((await post(staff, `${f.dispute.id}/evidence-access`, {})).status).toBe(200);
    },
  );
});
