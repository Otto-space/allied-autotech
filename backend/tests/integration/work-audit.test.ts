import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { auditPageResponseSchema } from "../../src/modules/audit/audit-response.schemas.js";
import { AuditOperationsService } from "../../src/modules/audit/audit.service.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
const app = createApp({ checkReadiness: async () => undefined });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "current authorized audit inspection",
  () => {
    const sessions: string[] = [],
      originalUsers: string[] = [],
      originalAudit: string[] = [],
      reference = `work-audit-${randomUUID()}`;
    let owner: Awaited<ReturnType<typeof auth>>,
      admin: Awaited<ReturnType<typeof auth>>,
      staff: Awaited<ReturnType<typeof auth>>,
      before: string,
      counts: number[];
    const digest = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const snapshot = () =>
      Promise.all([
        prisma.user.findMany({
          where: { id: { in: originalUsers } },
          orderBy: { id: "asc" },
        }),
        prisma.customerProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.privilegedInvitation.findMany({ orderBy: { id: "asc" } }),
        prisma.outboxEvent.findMany({ orderBy: { id: "asc" } }),
        prisma.userCapability.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
        prisma.auditLog.findMany({
          where: { id: { in: originalAudit } },
          orderBy: { id: "asc" },
        }),
      ]);
    async function auth(userId: string, assured = true) {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiresAt = new Date(Date.now() + 3600000);
      const session = await prisma.session.create({
        data: {
          userId,
          createdAt: new Date(Date.now() - 1000),
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          expiresAt,
          idleExpiresAt: expiresAt,
          mfaRequired: true,
          mfaVerifiedAt: assured ? new Date() : null,
        },
      });
      sessions.push(session.id);
      return {
        userId,
        sessionId: session.id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
        },
      };
    }
    beforeAll(async () => {
      expect(
        (
          await prisma.$queryRaw<
            { database: string; host: string; port: number }[]
          >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`
        )[0],
      ).toEqual({
        database: "allied_work_staff_workforce_20261019_test",
        host: "127.0.0.1",
        port: 55480,
      });
      expect(env.NODE_ENV).toBe("test");
      expect(
        (
          await prisma.$queryRaw<
            { elevated: boolean }[]
          >`SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS elevated FROM pg_roles WHERE rolname=current_user`
        )[0],
      ).toEqual({ elevated: false });
      const base = JSON.parse(
        readFileSync(process.env.WORK_STAFF_WORKFORCE_FIXTURES!, "utf8"),
      );
      originalUsers.push(
        ...(await prisma.user.findMany({ select: { id: true } })).map((v) => v.id),
      );
      originalAudit.push(
        ...(await prisma.auditLog.findMany({ select: { id: true } })).map((v) => v.id),
      );
      const initial = await snapshot();
      before = digest(initial);
      counts = initial.map((rows) => rows.length);
      const user = await prisma.user.create({
        data: {
          email: `audit-${randomUUID()}@example.test`,
          role: "ADMIN",
          passwordHash: "unusable-isolated-test-only",
          emailVerifiedAt: new Date(),
        },
      });
      owner = await auth(base.owner);
      admin = await auth(user.id);
      staff = await auth(base.staffId);
      await prisma.auditLog.createMany({
        data: Array.from({ length: 28 }, (_, n) => ({
          userId: user.id,
          action: "UPDATE",
          entityType: "BRANCH",
          entityId: reference,
          requestId: reference,
          createdAt: new Date("2026-10-19T08:00:00.000Z"),
          oldValues: { active: false },
          newValues: {
            count: n,
            nested: [false, 0, null, ""],
            label: "Synthetic audit inspection",
          },
          ipAddress: "127.0.0.2",
          userAgent: "PRIVATE-AUDIT-TEST",
        })),
      });
      writeFileSync(
        process.env.WORK_AUDIT_FIXTURES!,
        JSON.stringify(
          { reference, admin: admin.userId, owner: owner.userId, expected: 28 },
          null,
          2,
        ),
      );
    });
    afterAll(async () => {
      try {
        if (before) expect(digest(await snapshot())).toBe(before);
      } finally {
        const cleanup = await prisma.session.deleteMany({
          where: { id: { in: sessions } },
        });
        expect(await prisma.session.count({ where: { id: { in: sessions } } })).toBe(0);
        console.info(
          JSON.stringify({
            originalCounts: counts,
            originalRowsUnchanged: true,
            ownedSessionsRemoved: cleanup.count,
          }),
        );
      }
    });
    const read = (query: Record<string, string | number> = {}, actor = admin) =>
      request(app)
        .get("/api/v1/admin/audit")
        .set(actor.headers)
        .query({ entityId: reference, ...query });
    it("preserves safe values and all filters through tied-time cursor pages and atomic READ audits", async () => {
      const expected = await prisma.auditLog.findMany({
        where: { entityId: reference },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      const beforeReads = await prisma.auditLog.count({
        where: {
          userId: admin.userId,
          action: "READ",
          newValues: { path: ["resource"], equals: "AUDIT_LOG" },
        },
      });
      const query = {
        userId: admin.userId,
        action: "UPDATE",
        entityType: "BRANCH",
        requestId: reference,
        from: "2026-10-19T09:00:00+01:00",
        to: "2026-10-19T09:00:00+01:00",
      };
      const first = await read(query).expect(200),
        page = auditPageResponseSchema.parse(first.body.data);
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(page.items).toHaveLength(25);
      const second = auditPageResponseSchema.parse(
        (await read({ ...query, cursor: page.nextCursor! }).expect(200)).body.data,
      );
      expect(second.items).toHaveLength(3);
      expect(second.nextCursor).toBeUndefined();
      expect([...page.items, ...second.items].map((v) => v.id)).toEqual(
        expected.map((v) => v.id),
      );
      expect(page.items[0]!.newValues).toMatchObject({ nested: [false, 0, null, ""] });
      expect(JSON.stringify(first.body)).not.toMatch(
        /PRIVATE-AUDIT-TEST|ipAddress|userAgent|passwordHash|tokenHash/,
      );
      expect(
        await prisma.auditLog.count({
          where: {
            userId: admin.userId,
            action: "READ",
            newValues: { path: ["resource"], equals: "AUDIT_LOG" },
          },
        }),
      ).toBe(beforeReads + 2);
      expect(
        (await read({ to: "2026-10-19T07:59:59Z" }, owner).expect(200)).body.data.items,
      ).toEqual([]);
      await read({ from: "2026-01-01T00:00:00Z", to: "2026-05-01T00:00:00Z" }).expect(
        400,
      );
      await read({ action: "INVALID" }).expect(422);
    });
    it("rejects staff, unverified sessions and stale service actors without exposing history or appending successful READs", async () => {
      await read({}, staff).expect(403);
      await read({}, await auth(admin.userId, false)).expect(403);
      const actor: AuthenticatedActor = {
        userId: admin.userId,
        sessionId: admin.sessionId,
        email: "synthetic@example.test",
        role: "ADMIN",
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const beforeReads = await prisma.auditLog.count({
        where: { userId: admin.userId, action: "READ" },
      });
      await prisma.user.update({
        where: { id: admin.userId },
        data: { status: "SUSPENDED" },
      });
      await expect(
        new AuditOperationsService().audit(
          actor,
          { limit: 25 },
          { requestId: randomUUID(), ipAddress: null, userAgent: null },
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(
        await prisma.auditLog.count({ where: { userId: admin.userId, action: "READ" } }),
      ).toBe(beforeReads);
      await prisma.user.update({
        where: { id: admin.userId },
        data: { status: "ACTIVE" },
      });
      await prisma.session.update({
        where: { id: admin.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(
        new AuditOperationsService().audit(
          actor,
          { limit: 25 },
          { requestId: randomUUID(), ipAddress: null, userAgent: null },
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(
        await prisma.auditLog.count({ where: { userId: admin.userId, action: "READ" } }),
      ).toBe(beforeReads);
    });
  },
);
