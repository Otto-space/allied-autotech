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
  root = "/api/v1/staff/disputes";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "dispute current records and eligible operators",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let admin: Actor,
      primary: Actor,
      backup: Actor,
      outsider: Actor,
      noGrant: Actor,
      owner: Actor,
      customer: Actor,
      unverified: Actor;
    let grantOwner: string,
      disputeId: string,
      closedId: string,
      beforeHash: string,
      prefix: string;
    const sessions: string[] = [],
      originalIds: string[] = [],
      excluded: string[] = [];
    const digest = (value: unknown) =>
      createHash("sha256")
        .update(
          JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
        )
        .digest("hex");
    const protectedRows = async () =>
      digest(
        await Promise.all([
          prisma.payment.findMany({ orderBy: { id: "asc" } }),
          prisma.paymentAttempt.findMany({ orderBy: { id: "asc" } }),
          prisma.refund.findMany({ orderBy: { id: "asc" } }),
          prisma.invoice.findMany({ orderBy: { id: "asc" } }),
          prisma.paymentLedgerEntry.findMany({ orderBy: { id: "asc" } }),
          prisma.paymentDispute.findMany({
            where: { id: { in: originalIds } },
            orderBy: { id: "asc" },
          }),
        ]),
      );
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
    async function operator(
      label: string,
      role: "ADMIN" | "STAFF" = "STAFF",
      eligible = "yes",
    ) {
      const u = await prisma.user.create({
        data: {
          email: `${prefix}-${label}@example.test`,
          passwordHash: "unusable-isolated-test-only",
          role,
          status: eligible === "inactive" ? "SUSPENDED" : "ACTIVE",
          emailVerifiedAt: eligible === "unverified" ? null : new Date(),
          staffProfile: { create: { firstName: "Synthetic", lastName: label } },
        },
      });
      if (eligible !== "no-grant")
        await prisma.userCapability.create({
          data: {
            userId: u.id,
            capability: "DISPUTE_MANAGE",
            grantedByUserId: grantOwner,
            revokedAt: eligible === "revoked" ? new Date() : null,
          },
        });
      return auth(u.id, role);
    }
    beforeAll(async () => {
      const [actual] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(actual).toEqual({
        database: "allied_work_aftercare_20261017_test",
        host: "127.0.0.1",
        port: 55480,
      });
      expect(env.NODE_ENV).toBe("test");
      const base = JSON.parse(readFileSync(process.env.WORK_PAYMENT_FIXTURES!, "utf8"));
      grantOwner = base.owner;
      prefix = `dispute-${randomUUID()}`;
      originalIds.push(
        ...(await prisma.paymentDispute.findMany({ select: { id: true } })).map(
          (r) => r.id,
        ),
      );
      beforeHash = await protectedRows();
      admin = await operator("admin", "ADMIN");
      primary = await operator("primary");
      backup = await operator("backup");
      outsider = await operator("outsider");
      noGrant = await operator("no-grant", "ADMIN", "no-grant");
      owner = await auth(base.owner, "SUPER_ADMIN");
      customer = await auth(base.customer, "CUSTOMER");
      unverified = await auth(admin.id, "ADMIN", false);
      for (const kind of ["inactive", "unverified", "revoked"])
        excluded.push((await operator(kind, "STAFF", kind)).id);
      const attempt = await prisma.paymentAttempt.findFirstOrThrow({
        orderBy: { id: "asc" },
        select: { id: true, provider: true },
      });
      const data = {
        paymentAttemptId: attempt.id,
        provider: attempt.provider,
        category: "OTHER" as const,
        amountKobo: 9223372036854775807n,
        openedAt: new Date(Date.now() - 3600000),
        primaryUserId: primary.id,
        backupUserId: backup.id,
        reason: "PRIVATE_DISPUTE_SOURCE_NOT_FOR_UI",
      };
      disputeId = (
        await prisma.paymentDispute.create({
          data: {
            ...data,
            providerDisputeId: `${prefix}-open`,
            status: "AWAITING_RESPONSE",
          },
        })
      ).id;
      closedId = (
        await prisma.paymentDispute.create({
          data: {
            ...data,
            providerDisputeId: `${prefix}-closed`,
            status: "WON",
            resolvedAt: new Date(),
          },
        })
      ).id;
      if (process.env.WORK_DISPUTE_HANDLING_FIXTURES)
        writeFileSync(
          process.env.WORK_DISPUTE_HANDLING_FIXTURES,
          JSON.stringify(
            {
              admin: admin.id,
              primary: primary.id,
              backup: backup.id,
              outsider: outsider.id,
              noGrant: noGrant.id,
              owner: owner.id,
              customer: customer.id,
              disputeId,
              closedId,
              originalIds,
              prefix,
            },
            null,
            2,
          ),
        );
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
    });
    it("returns private safe current facts only within live capability and assignment scope", async () => {
      const before = await prisma.auditLog.count({
        where: { entityId: disputeId, action: "READ" },
      });
      for (const actor of [admin, primary, backup]) {
        const r = await request(app).get(`${root}/${disputeId}`).set(actor.headers);
        expect(r.status).toBe(200);
        expect(r.headers["cache-control"]).toBe("private, no-store");
        expect(r.body.data.amountKobo).toBe("9223372036854775807");
        expect(r.body.data.primaryUserId).toBe(primary.id);
        for (const key of ["reason", "evidenceObjectKey", "evidenceSha256"])
          expect(r.body.data).not.toHaveProperty(key);
      }
      expect(
        await prisma.auditLog.count({ where: { entityId: disputeId, action: "READ" } }),
      ).toBe(before + 3);
      for (const actor of [outsider, noGrant, owner, customer, unverified])
        expect(
          (await request(app).get(`${root}/${disputeId}`).set(actor.headers)).status,
        ).toBe(403);
      expect((await request(app).get(`${root}/${disputeId}`)).status).toBe(401);
      expect(
        (await request(app).get(`${root}/${randomUUID()}`).set(admin.headers)).status,
      ).toBe(404);
      expect(
        (await request(app).get(`${root}/${disputeId}?unsafe=true`).set(admin.headers))
          .status,
      ).toBe(422);
      expect((await request(app).get(`${root}/bad-id`).set(admin.headers)).status).toBe(
        422,
      );
    });
    it("bounds, filters and audits operator discovery without exposing ineligible choices", async () => {
      const r = await request(app)
        .get(`${root}/operators?q=${prefix}&limit=2`)
        .set(admin.headers);
      expect(r.status).toBe(200);
      expect(r.headers["cache-control"]).toBe("private, no-store");
      expect(r.body.data.items).toHaveLength(2);
      expect(r.body.data.nextCursor).toBe(r.body.data.items[1].id);
      const second = await request(app)
        .get(`${root}/operators?q=${prefix}&limit=2&cursor=${r.body.data.nextCursor}`)
        .set(admin.headers);
      expect(second.status).toBe(200);
      expect(second.body.data.items).toHaveLength(2);
      expect(second.body.data.nextCursor).toBeNull();
      const rows = [...r.body.data.items, ...second.body.data.items];
      expect(rows.map((v) => v.id).sort()).toEqual(
        [admin.id, primary.id, backup.id, outsider.id].sort(),
      );
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual(["id", "label"]);
        expect(excluded).not.toContain(row.id);
      }
      for (const actor of [primary, noGrant, owner, customer, unverified])
        expect(
          (await request(app).get(`${root}/operators`).set(actor.headers)).status,
        ).toBe(403);
      expect(
        (await request(app).get(`${root}/operators?limit=51`).set(admin.headers)).status,
      ).toBe(422);
      expect(
        (await request(app).get(`${root}/operators?status=ACTIVE`).set(admin.headers))
          .status,
      ).toBe(422);
      const log = await prisma.auditLog.findFirstOrThrow({
        where: {
          userId: admin.id,
          action: "READ",
          newValues: { path: ["resource"], equals: "DISPUTE_ELIGIBLE_OPERATORS" },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(log.newValues).toEqual({
        resource: "DISPUTE_ELIGIBLE_OPERATORS",
        returnedCount: 2,
      });
    });
    it("keeps queue scope, closed history, conditional writes and financial records intact", async () => {
      const before = await prisma.auditLog.count({
        where: {
          userId: primary.id,
          action: "READ",
          newValues: { path: ["resource"], equals: "DISPUTE_WORK_QUEUE" },
        },
      });
      const open = await request(app).get(`${root}?openOnly=true`).set(primary.headers);
      expect(open.status).toBe(200);
      expect(open.headers["cache-control"]).toBe("private, no-store");
      expect(open.body.data.items.map((v: { id: string }) => v.id)).toEqual([disputeId]);
      const all = await request(app).get(`${root}?openOnly=false`).set(primary.headers);
      expect(all.body.data.items).toHaveLength(2);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: primary.id,
            action: "READ",
            newValues: { path: ["resource"], equals: "DISPUTE_WORK_QUEUE" },
          },
        }),
      ).toBe(before + 2);
      const current = (
        await request(app).get(`${root}/${disputeId}`).set(primary.headers)
      ).body.data;
      const body = {
        note: "Synthetic acknowledgement evidence",
        expectedUpdatedAt: current.updatedAt,
      };
      const saved = await request(app)
        .post(`${root}/${disputeId}/acknowledge`)
        .set(primary.headers)
        .send(body);
      expect(saved.status).toBe(200);
      expect(saved.body.data.acknowledgedByUserId).toBe(primary.id);
      expect(
        (
          await request(app)
            .post(`${root}/${disputeId}/acknowledge`)
            .set(backup.headers)
            .send(body)
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .post(`${root}/${closedId}/acknowledge`)
            .set(primary.headers)
            .send({ note: body.note })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .post(`${root}/${disputeId}/assign`)
            .set(primary.headers)
            .send({ primaryUserId: primary.id, backupUserId: backup.id })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(`${root}/${disputeId}/assign`)
            .set(admin.headers)
            .send({ primaryUserId: primary.id, backupUserId: noGrant.id })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .post(`${root}/${disputeId}/acknowledge?unsafe=true`)
            .set(primary.headers)
            .send(body)
        ).status,
      ).toBe(422);
      expect(await protectedRows()).toBe(beforeHash);
    });
  },
);
