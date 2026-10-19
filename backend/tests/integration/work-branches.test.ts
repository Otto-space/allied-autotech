import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { OrganizationService } from "../../src/modules/organization/organization.service.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";

const app = createApp({ checkReadiness: async () => undefined });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "branch administration contracts",
  () => {
    let tag = randomUUID().slice(0, 8).toUpperCase();
    const sessions: string[] = [],
      originalUsers: string[] = [],
      originalBranches: string[] = [];
    const hash = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    let before: string,
      owner: Awaited<ReturnType<typeof auth>>,
      admin: Awaited<ReturnType<typeof auth>>,
      staff: Awaited<ReturnType<typeof auth>>;
    let selected: { id: string; updatedAt: string; code: string }, newStaff: string;
    const added: string[] = [];
    const snapshot = () =>
      Promise.all([
        prisma.user.findMany({
          where: { id: { in: originalUsers } },
          orderBy: { id: "asc" },
        }),
        prisma.customerProfile.findMany({
          where: { userId: { in: originalUsers } },
          orderBy: { id: "asc" },
        }),
        prisma.staffProfile.findMany({
          where: { userId: { in: originalUsers } },
          orderBy: { id: "asc" },
        }),
        prisma.branch.findMany({
          where: { id: { in: originalBranches } },
          orderBy: { id: "asc" },
        }),
        prisma.privilegedInvitation.findMany({ orderBy: { id: "asc" } }),
        prisma.outboxEvent.findMany({ orderBy: { id: "asc" } }),
        prisma.userCapability.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
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
          "X-CSRF-Token": csrf,
        },
      };
    }
    const body = (n: number) => ({
      code: `BQ-${tag}-${n}`,
      name: `Branch ${tag} workshop ${n}`,
      address: "Synthetic isolated address",
      city: `City ${tag}`,
      state: `State ${tag}`,
      country: "Nigeria",
      timezone: "Africa/Lagos",
      phone: "+2348000000000",
      email: `branch-${n}@example.test`,
      isActive: n !== 2,
    });
    const patch = (change: Record<string, unknown>) =>
      request(app)
        .patch(`/api/v1/admin/branches/${selected.id}`)
        .set(admin.headers)
        .send(change);
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
      const retained =
        process.env.WORK_BRANCH_RESUME === "true"
          ? JSON.parse(readFileSync(process.env.WORK_BRANCH_FIXTURES!, "utf8"))
          : undefined;
      originalUsers.push(
        ...(await prisma.user.findMany({ select: { id: true } })).map((v) => v.id),
      );
      originalBranches.push(
        ...(await prisma.branch.findMany({ select: { id: true } })).map((v) => v.id),
      );
      if (retained) {
        tag = retained.tag;
        added.push(...retained.added);
        newStaff = retained.newStaff;
        for (const owned of [retained.admin, newStaff]) {
          const index = originalUsers.indexOf(owned);
          if (index >= 0) originalUsers.splice(index, 1);
        }
        for (const owned of added) {
          const index = originalBranches.indexOf(owned);
          if (index >= 0) originalBranches.splice(index, 1);
        }
      }
      before = hash(await snapshot());
      owner = await auth(base.owner);
      staff = await auth(base.staffId);
      if (retained) {
        admin = await auth(retained.admin);
        const row = await prisma.branch.findUniqueOrThrow({
          where: { id: retained.selected },
        });
        selected = { id: row.id, code: row.code, updatedAt: row.updatedAt.toISOString() };
        await prisma.user.update({ where: { id: newStaff }, data: { status: "ACTIVE" } });
        return;
      }
      const account = await prisma.user.create({
        data: {
          email: `branch-admin-${tag}@example.test`,
          role: "ADMIN",
          passwordHash: "unusable-isolated-test-only",
          emailVerifiedAt: new Date(),
          staffProfile: {
            create: {
              firstName: "Synthetic",
              lastName: "Branch administrator",
              branchId: base.branchId,
            },
          },
        },
      });
      admin = await auth(account.id);
      for (let n = 0; n < 3; n++) {
        const created = await request(app)
          .post("/api/v1/admin/branches")
          .set(n === 0 ? admin.headers : owner.headers)
          .send(body(n))
          .expect(201);
        expect(created.headers["cache-control"]).toBe("private, no-store");
        expect(created.body.data).toMatchObject(body(n));
        added.push(created.body.data.id);
        if (n === 0) selected = created.body.data;
      }
      const literal = await prisma.branch.create({
        data: { ...body(3), name: `Literal ${tag} %_\\ workshop` },
      });
      added.push(literal.id);
      const assigned = await prisma.user.create({
        data: {
          email: `branch-staff-${tag}@example.test`,
          role: "STAFF",
          passwordHash: "unusable-isolated-test-only",
          emailVerifiedAt: new Date(),
          staffProfile: {
            create: {
              firstName: "Synthetic",
              lastName: "Assigned branch staff",
              branchId: selected.id,
            },
          },
        },
      });
      newStaff = assigned.id;
      writeFileSync(
        process.env.WORK_BRANCH_FIXTURES!,
        JSON.stringify(
          { tag, added, admin: admin.userId, newStaff, selected: selected.id },
          null,
          2,
        ),
      );
    });
    afterAll(async () => {
      try {
        if (before) expect(hash(await snapshot())).toBe(before);
        console.info(
          JSON.stringify({
            originalUsers: originalUsers.length,
            originalBranches: originalBranches.length,
            originalRowsUnchanged: !!before,
            ownedSessionsRemoved: sessions.length,
            addedBranches: added.length,
          }),
        );
      } finally {
        await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      }
    });
    it("combines literal case-insensitive search, exact code, status and UUID cursor pagination with private safe DTOs", async () => {
      const search = async (query: Record<string, unknown>) => {
        const response = await request(app)
          .get("/api/v1/admin/branches")
          .query(query)
          .set(admin.headers)
          .expect(200);
        expect(response.headers["cache-control"]).toBe("private, no-store");
        return response.body.data;
      };
      const first = await search({ q: tag.toLowerCase(), limit: 2 });
      const second = await search({ q: tag, limit: 2, cursor: first.nextCursor });
      expect([...first.items, ...second.items].map((v) => v.id)).toEqual(
        [...added].sort(),
      );
      expect(second.nextCursor).toBeUndefined();
      for (const term of [`city ${tag}`, `state ${tag}`, `bq-${tag}`])
        expect((await search({ q: term })).items).toHaveLength(4);
      expect((await search({ q: tag, isActive: false })).items.map((v) => v.id)).toEqual([
        added[2],
      ]);
      expect(
        (await search({ code: selected.code.toLowerCase() })).items.map((v) => v.id),
      ).toEqual([selected.id]);
      expect((await search({ q: "%_\\" })).items.map((v) => v.id)).toEqual([added[3]]);
      const detail = await request(app)
        .get(`/api/v1/admin/branches/${selected.id}`)
        .set(owner.headers)
        .expect(200);
      expect(detail.headers["cache-control"]).toBe("private, no-store");
      expect(Object.keys(detail.body.data).sort()).toEqual(
        [
          "id",
          "code",
          "name",
          "phone",
          "email",
          "address",
          "city",
          "state",
          "country",
          "timezone",
          "isActive",
          "createdAt",
          "updatedAt",
        ].sort(),
      );
    });
    it("enforces expected revision, single-winner concurrent edits, nullable contacts and legacy compatibility", async () => {
      const saved = await patch({
        name: `Edited ${tag}`,
        phone: null,
        email: null,
        expectedRevision: selected.updatedAt,
      }).expect(200);
      expect(saved.body.data).toMatchObject({
        name: `Edited ${tag}`,
        phone: null,
        email: null,
        address: body(0).address,
      });
      expect(Date.parse(saved.body.data.updatedAt)).toBeGreaterThan(
        Date.parse(selected.updatedAt),
      );
      await patch({ name: "Stale edit", expectedRevision: selected.updatedAt }).expect(
        409,
      );
      selected = saved.body.data;
      const results = await Promise.all([
        patch({ city: `First ${tag}`, expectedRevision: selected.updatedAt }),
        patch({ city: `Second ${tag}`, expectedRevision: selected.updatedAt }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      selected = results.find((r) => r.status === 200)!.body.data;
      const compatible = await patch({ state: `Legacy ${tag}` }).expect(200);
      selected = compatible.body.data;
      const audits = await prisma.auditLog.findMany({
        where: { entityType: "BRANCH", entityId: selected.id, action: "UPDATE" },
      });
      expect(audits).toHaveLength(3);
      expect(JSON.stringify(audits.map((v) => v.newValues))).not.toContain(
        "expectedRevision",
      );
    });
    it("blocks deactivation with active assigned staff and preserves the active-only public contract", async () => {
      await patch({ isActive: false, expectedRevision: selected.updatedAt }).expect(409);
      await prisma.user.update({
        where: { id: newStaff },
        data: { status: "SUSPENDED" },
      });
      const inactive = await patch({
        isActive: false,
        expectedRevision: selected.updatedAt,
      }).expect(200);
      selected = inactive.body.data;
      await request(app).get(`/api/v1/public/branches/${selected.id}`).expect(404);
      const active = await patch({
        isActive: true,
        expectedRevision: selected.updatedAt,
      }).expect(200);
      selected = active.body.data;
      await request(app).get(`/api/v1/public/branches/${selected.id}`).expect(200);
    });
    it("rejects invalid inputs, staff access, missing CSRF, incomplete MFA and stale service actors", async () => {
      for (const query of [
        { q: "x" },
        { code: "!" },
        { isActive: "yes" },
        { q: "valid", extra: "invalid" },
      ])
        await request(app)
          .get("/api/v1/admin/branches")
          .query(query)
          .set(admin.headers)
          .expect(422);
      for (const change of [
        { expectedRevision: selected.updatedAt },
        { timezone: "Invalid/place" },
        { code: "!" },
        { phone: "bad" },
      ])
        await patch(change).expect(422);
      await request(app)
        .post("/api/v1/admin/branches")
        .set(admin.headers)
        .send(body(1))
        .expect(409);
      await request(app).get("/api/v1/admin/branches").set(staff.headers).expect(403);
      await request(app)
        .patch(`/api/v1/admin/branches/${selected.id}`)
        .set({ Cookie: admin.headers.Cookie, Origin: admin.headers.Origin })
        .send({ name: "Missing CSRF" })
        .expect(403);
      const unverified = await auth(admin.userId, false);
      await request(app)
        .get("/api/v1/admin/branches")
        .set(unverified.headers)
        .expect(403);
      const actor: AuthenticatedActor = {
        userId: admin.userId,
        sessionId: admin.sessionId,
        email: `branch-admin-${tag}@example.test`,
        role: "ADMIN",
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      await prisma.user.update({
        where: { id: admin.userId },
        data: { status: "SUSPENDED" },
      });
      const service = new OrganizationService(),
        context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
      for (const operation of [
        () => service.branches(actor, { limit: 25 }, context),
        () => service.branch(actor, selected.id, context),
        () => service.updateBranch(actor, selected.id, { name: "Stale actor" }, context),
        () => service.createBranch(actor, body(4), context),
      ])
        await expect(operation()).rejects.toMatchObject({ statusCode: 403 });
      await prisma.user.update({
        where: { id: admin.userId },
        data: { status: "ACTIVE" },
      });
    });
  },
);
