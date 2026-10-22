import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
const app = createApp({ checkReadiness: async () => undefined });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "current refund inspection",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let admin: Actor, owner: Actor, customer: Actor, unverified: Actor;
    let approver: Actor, transfer: Actor, checker: Actor, revocable: Actor;
    const sessions: string[] = [],
      refunds: string[] = [];
    const path = "/api/v1/staff/refunds";
    const get = (id: string, who = admin) =>
      request(app).get(`${path}/${id}`).set(who.headers);
    async function auth(id: string, role: string, assured = true): Promise<Actor> {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expires = new Date(Date.now() + 3600000);
      const s = await prisma.session.create({
        data: {
          userId: id,
          createdAt: new Date(Date.now() - 1000),
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          expiresAt: expires,
          idleExpiresAt: expires,
          mfaRequired: role !== "CUSTOMER",
          mfaVerifiedAt: role !== "CUSTOMER" && assured ? new Date() : null,
        },
      });
      sessions.push(s.id);
      return {
        id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "x-csrf-token": csrf,
        },
      };
    }
    async function staff(capability: string) {
      const user = await prisma.user.create({
        data: {
          email: `refund-inspection-${randomUUID()}@example.test`,
          passwordHash: "unusable-qa-only",
          role: "STAFF",
          emailVerifiedAt: new Date(),
          staffProfile: {
            create: { firstName: "Synthetic", lastName: "Refund operator" },
          },
        },
      });
      await prisma.userCapability.create({
        data: { userId: user.id, capability, grantedByUserId: owner.id },
      });
      return auth(user.id, "STAFF");
    }
    beforeAll(async () => {
      const [target] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(target).toEqual({
        database: env.DB_NAME,
        host: env.DB_HOST,
        port: env.DB_PORT,
      });
      expect(target?.database).toMatch(/_(test|ci)$/);
      const base = JSON.parse(readFileSync(process.env.WORK_PAYMENT_FIXTURES!, "utf8"));
      admin = await auth(base.admin, "ADMIN");
      owner = await auth(base.owner, "SUPER_ADMIN");
      customer = await auth(base.customer, "CUSTOMER");
      unverified = await auth(base.admin, "ADMIN", false);
      const destination = process.env.WORK_REFUND_FIXTURES;
      if (process.env.WORK_REFUND_REUSE_FIXTURES === "true" && destination) {
        const saved = JSON.parse(readFileSync(destination, "utf8"));
        approver = await auth(saved.approver, "STAFF");
        transfer = await auth(saved.transfer, "STAFF");
        checker = await auth(saved.checker, "STAFF");
        revocable = await auth(saved.revocable, "STAFF");
        refunds.push(...saved.refunds);
        const original = await prisma.refund.findUniqueOrThrow({
          where: { id: refunds[0]! },
          select: {
            paymentAttemptId: true,
            requestedByUserId: true,
            amountKobo: true,
            reason: true,
          },
        });
        refunds[4] = (
          await prisma.refund.create({
            data: {
              ...original,
              refundNumber: `QR-${randomUUID()}`,
              idempotencyKeyHash: hashToken("refund-note-fixture", randomUUID()),
            },
          })
        ).id;
        writeFileSync(destination, JSON.stringify({ ...saved, refunds }, null, 2));
        return;
      }
      approver = await staff("REFUND_APPROVE");
      transfer = await staff("REFUND_TRANSFER");
      checker = await staff("REFUND_CHECK");
      revocable = await staff("REFUND_APPROVE");
      const order = await prisma.order.create({
        data: {
          customerId: base.customerId,
          branchId: base.branchId,
          orderNumber: `QR-${randomUUID()}`,
          subtotalKobo: 18500000n,
          totalKobo: 18500000n,
          customerName: "Synthetic refund customer",
          customerEmail: "refund-test@example.test",
          customerPhone: "+2348000000000",
        },
      });
      const payment = await prisma.payment.create({
        data: {
          customerId: base.customerId,
          orderId: order.id,
          paymentNumber: `QR-${randomUUID()}`,
          purpose: "ORDER_PAYMENT",
          amountKobo: 18500000n,
          status: "REQUIRES_REVIEW",
          idempotencyKeyHash: hashToken("refund-test", randomUUID()),
          attempts: {
            create: {
              attemptNumber: 1,
              internalReference: `QR-${randomUUID()}`,
              provider: "MANUAL",
              method: "BANK_TRANSFER",
              status: "PENDING",
              amountKobo: 18500000n,
              manualReview: {
                create: {
                  submittedByUserId: customer.id,
                  payerName: "Synthetic refund customer",
                  bankReference: "SYNTHETIC-REFUND-CAPTURE",
                  transferredAt: new Date(),
                },
              },
            },
          },
        },
        include: { attempts: true },
      });
      const capture = await request(app)
        .post(`/api/v1/staff/payments/manual-attempts/${payment.attempts[0]!.id}/review`)
        .set(admin.headers)
        .send({
          decision: "APPROVED",
          reviewerNote: "Matched synthetic captured bank receipt for refund verification",
        });
      expect(capture.status).toBe(200);
      const approvedAt = new Date(Date.now() - 120000),
        transferredAt = new Date(Date.now() - 60000);
      for (let n = 0; n < 5; n++)
        refunds.push(
          (
            await prisma.refund.create({
              data: {
                refundNumber: `QR-${randomUUID()}`,
                paymentAttemptId: payment.attempts[0]!.id,
                requestedByUserId: admin.id,
                amountKobo: 10000n,
                reason: "Synthetic returned part after inspection",
                idempotencyKeyHash: hashToken("refund-fixture", randomUUID()),
                status:
                  n === 1
                    ? "APPROVED"
                    : n === 2
                      ? "PROCESSING"
                      : n === 3
                        ? "CANCELLED"
                        : "REQUESTED",
                authorizationKind: "HUMAN",
                ...(n === 1 || n === 2
                  ? { approvedByUserId: approver.id, approvedAt }
                  : {}),
                ...(n === 2
                  ? {
                      transferredByUserId: transfer.id,
                      transferRecordedAt: transferredAt,
                      bankTransferAt: transferredAt,
                      evidenceObjectKey: "synthetic-private-refund-key",
                      bankReference: "SYNTHETIC-TRANSFER",
                    }
                  : {}),
                ...(n === 3
                  ? {
                      cancelledAt: new Date(),
                      failureMessage: "Synthetic cancellation note retained",
                    }
                  : {
                      failureMessage: "Private provider diagnostic must not be returned",
                    }),
              },
            })
          ).id,
        );
      if (destination)
        writeFileSync(
          destination,
          JSON.stringify(
            {
              admin: admin.id,
              owner: owner.id,
              customer: customer.id,
              approver: approver.id,
              transfer: transfer.id,
              checker: checker.id,
              revocable: revocable.id,
              refunds,
              paymentId: payment.id,
              attemptId: payment.attempts[0]!.id,
              customerId: base.customerId,
              branchId: base.branchId,
            },
            null,
            2,
          ),
        );
    });
    afterAll(async () => {
      if (sessions.length)
        await prisma.session.deleteMany({ where: { id: { in: sessions } } });
    });
    it("returns exact private current facts and minimal READ audits without bank/evidence diagnostics", async () => {
      const before = await prisma.auditLog.count({
        where: {
          userId: admin.id,
          action: "READ",
          entityType: "REFUND",
          entityId: refunds[0],
        },
      });
      const response = await get(refunds[0]!);
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      const row = response.body.data;
      expect(row).toMatchObject({
        id: refunds[0],
        amountKobo: "10000",
        status: "REQUESTED",
        cancelledAt: null,
        cancellationNote: null,
      });
      for (const key of [
        "failureMessage",
        "evidenceObjectKey",
        "evidenceSha256",
        "beneficiaryEncrypted",
        "bankReference",
        "policySnapshot",
        "idempotencyKeyHash",
      ])
        expect(row).not.toHaveProperty(key);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: admin.id,
            action: "READ",
            entityType: "REFUND",
            entityId: refunds[0],
          },
        }),
      ).toBe(before + 1);
      expect((await get(refunds[3]!)).body.data.cancellationNote).toBeNull();
      expect((await get(refunds[2]!, owner)).status).toBe(200);
    });
    it("preserves each delegated stage scope and denies revoked/customer/anonymous/unverified inspection", async () => {
      expect((await get(refunds[0]!, approver)).status).toBe(200);
      expect((await get(refunds[1]!, approver)).status).toBe(200);
      expect((await get(refunds[3]!, approver)).status).toBe(404);
      expect((await get(refunds[1]!, transfer)).status).toBe(200);
      expect((await get(refunds[0]!, transfer)).status).toBe(404);
      expect((await get(refunds[3]!, transfer)).status).toBe(404);
      expect((await get(refunds[2]!, checker)).status).toBe(200);
      expect((await get(refunds[1]!, checker)).status).toBe(404);
      expect((await get(refunds[0]!, revocable)).status).toBe(200);
      await prisma.userCapability.updateMany({
        where: { userId: revocable.id, capability: "REFUND_APPROVE", revokedAt: null },
        data: { revokedAt: new Date() },
      });
      expect((await get(refunds[0]!, revocable)).status).toBe(403);
      expect((await get(refunds[0]!, customer)).status).toBe(403);
      expect((await get(refunds[0]!, unverified)).status).toBe(403);
      expect((await request(app).get(`${path}/${refunds[0]}`)).status).toBe(401);
    });
    it("rejects unknown/array queries and invalid IDs; both original queues stay private", async () => {
      expect((await get(`${refunds[0]}?status=REQUESTED`)).status).toBe(422);
      expect((await get(`${refunds[0]}?x[]=1`)).status).toBe(422);
      expect((await get("not-a-uuid")).status).toBe(422);
      expect((await get(randomUUID())).status).toBe(404);
      for (const [url, actor] of [
        [path, approver],
        ["/api/v1/admin/operations/payment-refunds", admin],
      ] as const) {
        const r = await request(app).get(url).set(actor.headers);
        expect(r.status).toBe(200);
        expect(r.headers["cache-control"]).toBe("private, no-store");
        expect(JSON.stringify(r.body)).not.toContain("Private provider diagnostic");
      }
    });
    it("returns stored cancellation time and exact note without a ledger entry or repeat decision", async () => {
      const body = {
        decision: "CANCELLED",
        note: "Customer retained the inspected original part",
      };
      const response = await request(app)
        .post(`${path}/${refunds[4]}/decision`)
        .set(approver.headers)
        .send(body);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: refunds[4],
        status: "CANCELLED",
        amountKobo: "10000",
        cancellationNote: body.note,
      });
      expect(response.body.data.cancelledAt).toBeTruthy();
      expect(response.body.data).not.toHaveProperty("failureMessage");
      expect((await get(refunds[4]!)).body.data.cancelledAt).toBe(
        response.body.data.cancelledAt,
      );
      expect(
        (
          await request(app)
            .post(`${path}/${refunds[4]}/decision`)
            .set(approver.headers)
            .send(body)
        ).status,
      ).toBe(409);
      expect(
        await prisma.paymentLedgerEntry.count({ where: { refundId: refunds[4] } }),
      ).toBe(0);
      expect(
        await prisma.auditLog.count({
          where: { entityType: "REFUND", entityId: refunds[4], action: "STATUS_CHANGE" },
        }),
      ).toBe(1);
    });
  },
);
