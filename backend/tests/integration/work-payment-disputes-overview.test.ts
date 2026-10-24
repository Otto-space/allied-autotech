import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
const app = createApp({ checkReadiness: async () => undefined }),
  path = "/api/v1/admin/operations/payment-disputes";
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "private administrator dispute overview",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let admin: Actor,
      owner: Actor,
      staff: Actor,
      customer: Actor,
      unverified: Actor,
      financialHash: string,
      originalDisputesHash: string;
    const sessions: string[] = [],
      ids: string[] = [],
      originalIds: string[] = [];
    const digest = (v: unknown) =>
      createHash("sha256")
        .update(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)))
        .digest("hex");
    const financial = async () =>
      digest(
        await Promise.all([
          prisma.payment.findMany({ orderBy: { id: "asc" } }),
          prisma.paymentAttempt.findMany({ orderBy: { id: "asc" } }),
          prisma.refund.findMany({ orderBy: { id: "asc" } }),
          prisma.invoice.findMany({ orderBy: { id: "asc" } }),
          prisma.paymentLedgerEntry.findMany({ orderBy: { id: "asc" } }),
        ]),
      );
    const originalDisputes = async () =>
      digest(
        await prisma.paymentDispute.findMany({
          where: { id: { in: originalIds } },
          orderBy: { id: "asc" },
        }),
      );
    async function auth(id: string, role: string, assured = true): Promise<Actor> {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expires = new Date(Date.now() + 3600000),
        session = await prisma.session.create({
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
    beforeAll(async () => {
      const [target] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(target).toEqual({
        database: "allied_work_aftercare_20261017_test",
        host: "127.0.0.1",
        port: 55480,
      });
      const base = JSON.parse(readFileSync(process.env.WORK_PAYMENT_FIXTURES!, "utf8")),
        refund = JSON.parse(readFileSync(process.env.WORK_REFUND_FIXTURES!, "utf8"));
      admin = await auth(base.admin, "ADMIN");
      owner = await auth(base.owner, "SUPER_ADMIN");
      staff = await auth(refund.approver, "STAFF");
      customer = await auth(base.customer, "CUSTOMER");
      unverified = await auth(base.admin, "ADMIN", false);
      financialHash = await financial();
      originalIds.push(
        ...(await prisma.paymentDispute.findMany({ select: { id: true } })).map(
          (v) => v.id,
        ),
      );
      originalDisputesHash = await originalDisputes();
      const attempt = await prisma.paymentAttempt.findFirstOrThrow({
          orderBy: { id: "asc" },
          select: { id: true, provider: true },
        }),
        prefix = randomUUID(),
        now = Date.now();
      const needed = Math.max(
        0,
        26 -
          (await prisma.paymentDispute.count({
            where: { status: "AWAITING_RESPONSE", category: "OTHER" },
          })),
      );
      for (let n = 0; n < needed; n++) {
        const row = await prisma.paymentDispute.create({
          data: {
            paymentAttemptId: attempt.id,
            provider: attempt.provider,
            providerDisputeId: `SYNTHETIC-OVERVIEW-${prefix}-${n}`,
            status: "AWAITING_RESPONSE",
            category: "OTHER",
            amountKobo: n === 0 ? BigInt("9223372036854775807") : BigInt(12500000),
            openedAt: new Date(now - n * 1000),
            responseDueAt: new Date(now + 86400000),
            reason: "PRIVATE_SYNTHETIC_SOURCE_REASON_NOT_IN_OVERVIEW",
          },
        });
        ids.push(row.id);
      }
      if (process.env.WORK_DISPUTE_OVERVIEW_FIXTURES)
        writeFileSync(
          process.env.WORK_DISPUTE_OVERVIEW_FIXTURES,
          JSON.stringify(
            {
              admin: admin.id,
              owner: owner.id,
              staff: staff.id,
              customer: customer.id,
              addedFixtureIds: ids,
              originalIds,
            },
            null,
            2,
          ),
        );
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
    });
    it("returns private audited safe exact-money pages with supported filters and validation", async () => {
      const before = await prisma.auditLog.count({
          where: {
            action: "READ",
            userId: admin.id,
            newValues: { path: ["resource"], equals: "PAYMENT_DISPUTES" },
          },
        }),
        first = await request(app)
          .get(path + "?status=AWAITING_RESPONSE&category=OTHER&limit=25")
          .set(admin.headers);
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(first.body.data.items).toHaveLength(25);
      expect(first.body.data.nextCursor).toBe(first.body.data.items.at(-1).id);
      for (const row of first.body.data.items) {
        expect(row.status).toBe("AWAITING_RESPONSE");
        expect(row.category).toBe("OTHER");
        expect(typeof row.amountKobo).toBe("string");
        expect(row).not.toHaveProperty("evidenceObjectKey");
        expect(row).not.toHaveProperty("evidenceSha256");
        expect(row).not.toHaveProperty("reason");
      }
      expect(JSON.stringify(first.body)).not.toContain("PRIVATE_SYNTHETIC_SOURCE_REASON");
      const second = await request(app)
        .get(
          path +
            "?status=AWAITING_RESPONSE&category=OTHER&limit=25&cursor=" +
            first.body.data.nextCursor,
        )
        .set(admin.headers);
      expect(second.status).toBe(200);
      expect(second.body.data.items.length).toBeGreaterThan(0);
      expect(
        second.body.data.items.every(
          (v: { id: string }) =>
            !first.body.data.items.some((a: { id: string }) => a.id === v.id),
        ),
      ).toBe(true);
      expect(
        await prisma.auditLog.count({
          where: {
            action: "READ",
            userId: admin.id,
            newValues: { path: ["resource"], equals: "PAYMENT_DISPUTES" },
          },
        }),
      ).toBe(before + 2);
      expect((await request(app).get(path).set(owner.headers)).status).toBe(200);
      expect(
        (
          await request(app)
            .get(path + "?provider=PAYSTACK")
            .set(admin.headers)
        ).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .get(path + "?cursor=bad")
            .set(admin.headers)
        ).status,
      ).toBe(422);
    });
    it("rejects Staff, Customer, anonymous and unverified sessions and preserves existing records", async () => {
      for (const who of [staff, customer, unverified])
        expect((await request(app).get(path).set(who.headers)).status).toBe(403);
      expect((await request(app).get(path)).status).toBe(401);
      expect(await financial()).toBe(financialHash);
      expect(await originalDisputes()).toBe(originalDisputesHash);
    });
  },
);
