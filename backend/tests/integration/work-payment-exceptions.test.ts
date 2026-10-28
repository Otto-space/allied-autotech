import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
const app = createApp({ checkReadiness: async () => undefined }),
  path = "/api/v1/admin/operations/payment-anomalies";
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "administrator payment exception investigation",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let admin: Actor,
      owner: Actor,
      staff: Actor,
      customer: Actor,
      unverified: Actor,
      originalFinancialHash: string;
    const sessions: string[] = [],
      exceptions: string[] = [];
    const fingerprint = (value: unknown) =>
      createHash("sha256")
        .update(
          JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
        )
        .digest("hex");
    async function financial() {
      return fingerprint(
        await Promise.all([
          prisma.payment.findMany({ orderBy: { id: "asc" } }),
          prisma.paymentAttempt.findMany({ orderBy: { id: "asc" } }),
          prisma.refund.findMany({ orderBy: { id: "asc" } }),
          prisma.invoice.findMany({ orderBy: { id: "asc" } }),
          prisma.paymentLedgerEntry.findMany({ orderBy: { id: "asc" } }),
        ]),
      );
    }
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
    const get = (id: string, who = admin) =>
      request(app).get(`${path}/${id}`).set(who.headers);
    const change = (id: string, body: unknown, who = admin) =>
      request(app).post(`${path}/${id}/status`).set(who.headers).send(body);
    beforeAll(async () => {
      const [target] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(target).toEqual({
        database: "allied_work_aftercare_20261017_test",
        host: "127.0.0.1",
        port: 55480,
      });
      expect(target!.database).toMatch(/_(test|ci)$/);
      const base = JSON.parse(readFileSync(process.env.WORK_PAYMENT_FIXTURES!, "utf8")),
        refund = JSON.parse(readFileSync(process.env.WORK_REFUND_FIXTURES!, "utf8"));
      admin = await auth(base.admin, "ADMIN");
      owner = await auth(base.owner, "SUPER_ADMIN");
      staff = await auth(refund.approver, "STAFF");
      customer = await auth(base.customer, "CUSTOMER");
      unverified = await auth(base.admin, "ADMIN", false);
      const payment = await prisma.payment.findFirstOrThrow({
        orderBy: { id: "asc" },
        select: { id: true },
      });
      originalFinancialHash = await financial();
      for (let n = 0; n < 3; n++) {
        const row = await prisma.paymentAnomaly.create({
          data: {
            paymentId: payment.id,
            type: n === 1 ? "UNKNOWN_REFERENCE" : "AMOUNT_MISMATCH",
            summary: `Synthetic gate 84 investigation ${n}; no real provider event.`,
            details: { mustNeverReturn: "synthetic-private-provider-details" },
          },
        });
        exceptions.push(row.id);
      }
      if (process.env.WORK_EXCEPTION_FIXTURES)
        writeFileSync(
          process.env.WORK_EXCEPTION_FIXTURES,
          JSON.stringify(
            {
              admin: admin.id,
              owner: owner.id,
              staff: staff.id,
              customer: customer.id,
              exceptions,
            },
            null,
            2,
          ),
        );
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
    });
    it("returns safe audited private current facts, validates UUID/query and enforces role/MFA/CSRF boundaries", async () => {
      const before = await prisma.auditLog.count({
          where: { action: "READ", entityId: exceptions[0] },
        }),
        current = await get(exceptions[0]!);
      expect(current.status).toBe(200);
      expect(current.headers["cache-control"]).toBe("private, no-store");
      expect(current.body.data).toMatchObject({
        id: exceptions[0],
        status: "OPEN",
        resolutionNote: null,
        resolvedAt: null,
        resolvedByUserId: null,
      });
      expect(current.body.data).not.toHaveProperty("details");
      expect(JSON.stringify(current.body)).not.toContain("mustNeverReturn");
      expect(
        await prisma.auditLog.count({
          where: { action: "READ", entityId: exceptions[0] },
        }),
      ).toBe(before + 1);
      expect(
        (await request(app).get(path).set(admin.headers)).headers["cache-control"],
      ).toBe("private, no-store");
      expect((await get(exceptions[0]!, owner)).status).toBe(200);
      for (const who of [staff, customer, unverified])
        expect((await get(exceptions[0]!, who)).status).toBe(403);
      expect((await request(app).get(`${path}/${exceptions[0]}`)).status).toBe(401);
      expect((await get("bad")).status).toBe(422);
      expect(
        (
          await request(app)
            .get(`${path}/${exceptions[0]}?include=details`)
            .set(admin.headers)
        ).status,
      ).toBe(422);
      expect((await get(randomUUID())).status).toBe(404);
      expect(
        (
          await request(app)
            .post(`${path}/${exceptions[0]}/status`)
            .set({ Cookie: admin.headers.Cookie!, Origin: admin.headers.Origin! })
            .send({
              expectedStatus: "OPEN",
              status: "INVESTIGATING",
              resolutionNote: "Synthetic investigation.",
            })
        ).status,
      ).toBe(403);
    });
    it("starts once, returns the complete safe receipt and atomically rejects stale and invalid transitions", async () => {
      const id = exceptions[0]!,
        note = "Compared the synthetic source and provider observation.";
      expect(
        (
          await change(id, {
            expectedStatus: "OPEN",
            status: "RESOLVED",
            resolutionNote: note,
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await change(id, {
            expectedStatus: "OPEN",
            status: "INVESTIGATING",
            resolutionNote: "x",
          })
        ).status,
      ).toBe(422);
      const result = await change(id, {
        expectedStatus: "OPEN",
        status: "INVESTIGATING",
        resolutionNote: `  ${note}  `,
      });
      expect(result.status).toBe(200);
      expect(result.headers["cache-control"]).toBe("private, no-store");
      expect(result.body.data).toMatchObject({
        id,
        status: "INVESTIGATING",
        resolutionNote: note,
        resolvedAt: null,
        resolvedByUserId: null,
      });
      expect(result.body.data).toHaveProperty("detectedAt");
      expect(result.body.data).toHaveProperty("paymentId");
      expect(result.body.data).not.toHaveProperty("details");
      expect(
        (
          await change(id, {
            expectedStatus: "OPEN",
            status: "INVESTIGATING",
            resolutionNote: note,
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await change(id, {
            expectedStatus: "INVESTIGATING",
            status: "INVESTIGATING",
            resolutionNote: note,
          })
        ).status,
      ).toBe(409);
      expect(
        await prisma.auditLog.count({ where: { entityId: id, action: "STATUS_CHANGE" } }),
      ).toBe(1);
      expect(await financial()).toBe(originalFinancialHash);
    });
    it("closes once under concurrent administrator updates, cannot reopen, and preserves all existing financial rows", async () => {
      const id = exceptions[0]!,
        note = "Synthetic independent reconciliation complete.";
      const responses = await Promise.all([
        change(id, {
          expectedStatus: "INVESTIGATING",
          status: "RESOLVED",
          resolutionNote: note,
        }),
        change(
          id,
          { expectedStatus: "INVESTIGATING", status: "IGNORED", resolutionNote: note },
          owner,
        ),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      const current = await get(id),
        winner = responses.find((r) => r.status === 200)!;
      expect(current.body.data).toEqual(winner.body.data);
      expect(current.body.data.resolvedByUserId).toBe(
        current.body.data.status === "RESOLVED" ? admin.id : owner.id,
      );
      expect(current.body.data.resolvedAt).not.toBeNull();
      expect(
        await prisma.auditLog.count({ where: { entityId: id, action: "STATUS_CHANGE" } }),
      ).toBe(2);
      expect(
        (
          await change(id, {
            expectedStatus: "OPEN",
            status: "INVESTIGATING",
            resolutionNote: note,
          })
        ).status,
      ).toBe(409);
      const other = exceptions[1]!;
      expect(
        (
          await change(other, {
            expectedStatus: "OPEN",
            status: "INVESTIGATING",
            resolutionNote: note,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await change(other, {
            expectedStatus: "INVESTIGATING",
            status: "IGNORED",
            resolutionNote: note,
          })
        ).body.data.status,
      ).toBe("IGNORED");
      expect(await financial()).toBe(originalFinancialHash);
    });
  },
);
