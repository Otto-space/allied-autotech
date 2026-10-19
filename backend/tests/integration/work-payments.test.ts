import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { testOwner } from "../helpers/owner.js";

const app = createApp({ checkReadiness: async () => undefined });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "administrator payments",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let admin: Actor,
      other: Actor,
      staff: Actor,
      customer: Actor,
      owner: Actor,
      unverified: Actor;
    let customerId: string, branchId: string;
    const sessions: string[] = [],
      paging: string[] = [],
      attempts: string[] = [],
      orders: string[] = [];
    const path = "/api/v1/staff/payments";
    const get = (suffix: string, who = admin) =>
      request(app)
        .get(path + suffix)
        .set(who.headers);
    const post = (suffix: string, body: unknown, who = admin, key?: string) => {
      const req = request(app)
        .post(path + suffix)
        .set(who.headers);
      if (key) req.set("Idempotency-Key", key);
      return req.send(body);
    };
    async function auth(id: string, role: string, assured = true): Promise<Actor> {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expires = new Date(Date.now() + 3600000);
      const session = await prisma.session.create({
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
      sessions.push(session.id);
      return {
        id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "x-csrf-token": csrf,
        },
      };
    }
    async function account(role: "ADMIN" | "STAFF" | "CUSTOMER") {
      const user = await prisma.user.create({
        data: {
          email: `payment-quality-${randomUUID()}@example.test`,
          passwordHash: "unusable-qa-only",
          role,
          emailVerifiedAt: new Date(),
          ...(role === "CUSTOMER"
            ? {
                profile: {
                  create: {
                    firstName: "Payment",
                    lastName: "Customer",
                    phone: "+2348000000000",
                  },
                },
              }
            : {
                staffProfile: { create: { firstName: "Payment", lastName: "Operator" } },
              }),
        },
        include: { profile: true },
      });
      return { user, actor: await auth(user.id, role) };
    }
    async function manual(submitter = customer.id, offset = 0) {
      const order = await prisma.order.create({
        data: {
          customerId,
          branchId,
          orderNumber: `QP-${randomUUID()}`,
          status: "PENDING",
          subtotalKobo: 18500000n,
          totalKobo: 18500000n,
          customerName: "Synthetic Payment Customer",
          customerEmail: `qa-${randomUUID()}@example.test`,
          customerPhone: "+2348000000000",
          paymentDueAt: new Date(Date.now() + 86400000),
        },
      });
      const payment = await prisma.payment.create({
        data: {
          customerId,
          orderId: order.id,
          paymentNumber: `QP-${randomUUID()}`,
          purpose: "ORDER_PAYMENT",
          amountKobo: 18500000n,
          status: "REQUIRES_REVIEW",
          idempotencyKeyHash: hashToken("qa-payment", randomUUID()),
          createdAt: new Date(Date.now() - offset * 1000),
          expiresAt: order.paymentDueAt,
          attempts: {
            create: {
              attemptNumber: 1,
              internalReference: `QP-${randomUUID()}`,
              provider: "MANUAL",
              method: "BANK_TRANSFER",
              status: "PENDING",
              amountKobo: 18500000n,
              manualReview: {
                create: {
                  submittedByUserId: submitter,
                  payerName: "Synthetic Payment Customer",
                  bankReference: "QA-ONLY-REFERENCE",
                  transferredAt: new Date(),
                  reviewerNote: null,
                },
              },
            },
          },
        },
        include: { attempts: true },
      });
      return {
        paymentId: payment.id,
        attemptId: payment.attempts[0]!.id,
        orderId: order.id,
      };
    }
    async function approve() {
      const record = await manual();
      expect(
        (
          await post(`/manual-attempts/${record.attemptId}/review`, {
            decision: "APPROVED",
            reviewerNote: "Independently matched synthetic bank entry",
          })
        ).status,
      ).toBe(200);
      return record;
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
      const fixturePath = process.env.WORK_PAYMENT_FIXTURES;
      if (
        process.env.WORK_PAYMENT_REUSE_FIXTURES === "true" &&
        fixturePath &&
        existsSync(fixturePath)
      ) {
        const f = JSON.parse(readFileSync(fixturePath, "utf8"));
        admin = await auth(f.admin, "ADMIN");
        other = await auth(f.other, "ADMIN");
        staff = await auth(f.staff, "STAFF");
        customer = await auth(f.customer, "CUSTOMER");
        owner = await auth(f.owner, "SUPER_ADMIN");
        unverified = await auth(f.admin, "ADMIN", false);
        customerId = f.customerId;
        branchId = f.branchId;
        paging.push(...f.paging);
        attempts.push(...f.attempts);
        orders.push(...f.orders);
        return;
      }
      const a = await account("ADMIN"),
        b = await account("ADMIN"),
        s = await account("STAFF"),
        c = await account("CUSTOMER");
      admin = a.actor;
      other = b.actor;
      staff = s.actor;
      customer = c.actor;
      customerId = c.user.profile!.id;
      const originalOwner = await testOwner("unusable-qa-only");
      owner = await auth(originalOwner.id, "SUPER_ADMIN");
      unverified = await auth(admin.id, "ADMIN", false);
      branchId = (
        await prisma.branch.create({
          data: {
            code: `QP-${randomUUID().slice(0, 8)}`,
            name: "Synthetic payment QA",
            address: "Isolated test only",
            city: "Test",
            state: "Test",
          },
        })
      ).id;
      for (let n = 0; n < 28; n++) {
        const f = await manual(customer.id, n);
        paging.push(f.paymentId);
        attempts.push(f.attemptId);
        orders.push(f.orderId);
      }
      if (process.env.WORK_PAYMENT_FIXTURES)
        writeFileSync(
          process.env.WORK_PAYMENT_FIXTURES,
          JSON.stringify(
            {
              admin: admin.id,
              other: other.id,
              staff: staff.id,
              customer: customer.id,
              owner: owner.id,
              customerId,
              branchId,
              paging,
              attempts,
              orders,
            },
            null,
            2,
          ),
        );
    }, 60000);
    afterAll(async () => {
      if (sessions.length)
        await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });

    it("preserves 25+3 newest-first customer/status/provider paging and minimal private audits", async () => {
      const first = await get(
        `?customerId=${customerId}&status=REQUIRES_REVIEW&provider=MANUAL&limit=25`,
      );
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(first.body.data.items.map((x: { id: string }) => x.id)).toEqual(
        paging.slice(0, 25),
      );
      expect(first.body.data.nextCursor).toBe(paging[24]);
      const second = await get(
        `?customerId=${customerId}&status=REQUIRES_REVIEW&provider=MANUAL&limit=25&cursor=${paging[24]}`,
      );
      expect(second.status).toBe(200);
      expect(second.body.data.items.map((x: { id: string }) => x.id)).toEqual(
        paging.slice(25),
      );
      expect(second.body.data.nextCursor).toBeUndefined();
      const review = first.body.data.items[0].attempts[0].manualReview;
      expect(review.canReview).toBe(true);
      expect(review.reviewerNote).toBeNull();
      expect(review).not.toHaveProperty("submittedByUserId");
      expect(review).not.toHaveProperty("evidenceObjectKey");
      const audits = await prisma.auditLog.findMany({
        where: { userId: admin.id, action: "READ", entityType: "PAYMENT" },
      });
      expect(audits).toHaveLength(2);
      expect(audits[0]!.newValues).toMatchObject({ collection: "staff-payments" });
      expect(JSON.stringify(audits.map((x) => x.newValues))).not.toContain(customerId);
    });
    it("authorizes direct current reads and denies wrong roles, absent MFA, malformed scope and missing records", async () => {
      for (const who of [admin, owner]) {
        const r = await get(`/${paging[27]}`, who);
        expect(r.status).toBe(200);
        expect(r.body.data.id).toBe(paging[27]);
        expect(r.headers["cache-control"]).toBe("private, no-store");
      }
      for (const who of [staff, customer, unverified])
        expect((await get(`/${paging[0]}`, who)).status).toBe(403);
      expect((await request(app).get(path + `/${paging[0]}`)).status).toBe(401);
      expect((await get(`/${randomUUID()}`)).status).toBe(404);
      expect((await get(`/${paging[0]}?customerId=${customerId}`)).status).toBe(422);
      expect((await get("/invalid-reference")).status).toBe(422);
    });
    it("returns exact manual decisions atomically with settlement and hides staff notes from customer reads", async () => {
      const f = await manual(),
        body = {
          decision: "APPROVED",
          reviewerNote: "Exact independently checked bank entry",
        };
      const r = await post(`/manual-attempts/${f.attemptId}/review`, body);
      expect(r.status).toBe(200);
      expect(r.body.data.id).toBe(f.paymentId);
      expect(r.body.data.status).toBe("SUCCEEDED");
      const review = r.body.data.attempts[0].manualReview;
      expect(review).toMatchObject({
        status: "APPROVED",
        reviewerNote: body.reviewerNote,
        canReview: false,
      });
      expect(review.reviewedAt).toBeTruthy();
      expect(r.body.data).not.toHaveProperty("customerId");
      expect(review).not.toHaveProperty("submittedByUserId");
      expect((await get(`/${f.paymentId}`)).body.data.attempts[0].manualReview).toEqual(
        review,
      );
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: f.attemptId, type: "CAPTURE" },
        }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityId: f.attemptId, action: "MANUAL_PAYMENT_APPROVED" },
        }),
      ).toBe(1);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: f.orderId } })).paidAt,
      ).not.toBeNull();
      const own = await request(app)
        .get(`/api/v1/customers/payments/${f.paymentId}`)
        .set(customer.headers);
      expect(own.status).toBe(200);
      for (const key of ["reviewerNote", "canReview", "submittedByUserId"])
        expect(own.body.data.attempts[0].manualReview).not.toHaveProperty(key);
      expect((await post(`/manual-attempts/${f.attemptId}/review`, body)).status).toBe(
        409,
      );
    });
    it("keeps different-operator, CSRF, required notes and concurrent terminal decisions authoritative", async () => {
      const own = await manual(admin.id);
      expect(
        (await get(`/${own.paymentId}`)).body.data.attempts[0].manualReview.canReview,
      ).toBe(false);
      expect(
        (
          await post(`/manual-attempts/${own.attemptId}/review`, {
            decision: "REJECTED",
            reviewerNote: "Own review forbidden",
          })
        ).status,
      ).toBe(409);
      const f = await manual(),
        suffix = `/manual-attempts/${f.attemptId}/review`;
      expect(
        (await post(suffix, { decision: "REJECTED", reviewerNote: "" })).status,
      ).toBe(422);
      const noCsrf = {
        ...admin,
        headers: { ...admin.headers, "x-csrf-token": "invalid" },
      };
      expect(
        (
          await post(
            suffix,
            { decision: "REJECTED", reviewerNote: "Valid reason" },
            noCsrf,
          )
        ).status,
      ).toBe(403);
      const responses = await Promise.all([
        post(suffix, { decision: "REJECTED", reviewerNote: "First independent reason" }),
        post(
          suffix,
          { decision: "REJECTED", reviewerNote: "Second independent reason" },
          other,
        ),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      const saved = responses.find((r) => r.status === 200)!.body.data.attempts[0]
        .manualReview;
      expect(saved.status).toBe("REJECTED");
      expect(saved.reviewerNote).toMatch(/^(First|Second) independent reason$/);
      expect(
        await prisma.auditLog.count({
          where: { entityId: f.attemptId, action: "STATUS_CHANGE" },
        }),
      ).toBe(1);
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: f.attemptId },
        }),
      ).toBe(0);
    });
    it("binds refund replay to its requester and exact body with one safe record and audit", async () => {
      const f = await approve(),
        key = randomUUID(),
        body = {
          paymentAttemptId: f.attemptId,
          amountKobo: "12345",
          reason: "Exact synthetic refund reason",
        };
      const [first, repeat] = await Promise.all([
        post("/refunds", body, admin, key),
        post("/refunds", body, admin, key),
      ]);
      expect([first.status, repeat.status]).toEqual([201, 201]);
      expect(first.body.data.refund.id).toBe(repeat.body.data.refund.id);
      expect([first.body.data.replayed, repeat.body.data.replayed].sort()).toEqual([
        false,
        true,
      ]);
      expect(first.body.data.refund).toMatchObject({
        ...body,
        requestedByUserId: admin.id,
        status: "REQUESTED",
      });
      const lookup = () =>
        get(`/refunds/original-request?paymentAttemptId=${f.attemptId}`).set(
          "Idempotency-Key",
          key,
        );
      const recovered = await lookup();
      expect(recovered.status).toBe(200);
      expect(recovered.headers["cache-control"]).toBe("private, no-store");
      expect(recovered.body.data).toEqual({
        found: true,
        refund: first.body.data.refund,
      });
      expect(
        (
          await get(
            `/refunds/original-request?paymentAttemptId=${f.attemptId}`,
            other,
          ).set("Idempotency-Key", key)
        ).status,
      ).toBe(404);
      const absent = await get(
        `/refunds/original-request?paymentAttemptId=${f.attemptId}`,
      ).set("Idempotency-Key", randomUUID());
      expect(absent.status).toBe(200);
      expect(absent.body.data).toEqual({ found: false, refund: null });
      for (const who of [staff, customer, unverified])
        expect(
          (
            await get(
              `/refunds/original-request?paymentAttemptId=${f.attemptId}`,
              who,
            ).set("Idempotency-Key", key)
          ).status,
        ).toBe(403);
      expect(
        (await get(`/refunds/original-request?paymentAttemptId=${f.attemptId}`)).status,
      ).toBe(422);
      for (const key of [
        "idempotencyKeyHash",
        "beneficiaryEncrypted",
        "evidenceObjectKey",
        "reconciliationToken",
        "reconciliationLeaseUntil",
      ])
        expect(first.body.data.refund).not.toHaveProperty(key);
      expect((await post("/refunds", body, other, key)).status).toBe(409);
      expect(
        (await post("/refunds", { ...body, reason: "Different request" }, admin, key))
          .status,
      ).toBe(409);
      expect(
        await prisma.refund.count({ where: { paymentAttemptId: f.attemptId } }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityId: first.body.data.refund.id, action: "REFUND_REQUESTED" },
        }),
      ).toBe(1);
    });
    it("serializes separate refund commitments without permitting an over-refund", async () => {
      const f = await approve(),
        body = {
          paymentAttemptId: f.attemptId,
          amountKobo: "10000000",
          reason: "Synthetic separate refund commitment",
        };
      const result = await Promise.all([
        post("/refunds", body, admin, randomUUID()),
        post("/refunds", body, other, randomUUID()),
      ]);
      expect(result.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(
        await prisma.refund.count({ where: { paymentAttemptId: f.attemptId } }),
      ).toBe(1);
    });
  },
);
