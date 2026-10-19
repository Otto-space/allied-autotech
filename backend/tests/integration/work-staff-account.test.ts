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
  root = "/api/v1/admin/staff";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "staff account revision and private permissions",
  () => {
    type Actor = { id: string; sessionId: string; headers: Record<string, string> };
    let admin: Actor,
      owner: Actor,
      target: Actor,
      staffId: string,
      adminId: string,
      raceId: string,
      branchId: string,
      secondBranch: string,
      beforeHash: string;
    const sessions: string[] = [],
      originals: string[] = [],
      created: string[] = [];
    const revision = (r: {
      updatedAt: string;
      role: string;
      status: string;
      staffProfile: { updatedAt: string; branchId: string | null } | null;
    }) =>
      [
        r.updatedAt,
        r.role,
        r.status,
        r.staffProfile?.updatedAt,
        r.staffProfile?.branchId,
      ].join(":");
    const digest = (v: unknown) =>
      createHash("sha256").update(JSON.stringify(v)).digest("hex");
    async function protectedRows() {
      return digest(
        await Promise.all([
          prisma.user.findMany({
            where: { id: { in: originals } },
            orderBy: { id: "asc" },
          }),
          prisma.staffProfile.findMany({
            where: { userId: { in: originals } },
            orderBy: { id: "asc" },
          }),
          prisma.userCapability.findMany({
            where: { userId: { in: originals } },
            orderBy: { id: "asc" },
          }),
          prisma.branch.findMany({ orderBy: { id: "asc" } }),
        ]),
      );
    }
    async function auth(id: string) {
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
          mfaRequired: true,
          mfaVerifiedAt: new Date(),
        },
      });
      sessions.push(s.id);
      return {
        id,
        sessionId: s.id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "x-csrf-token": csrf,
        },
      };
    }
    async function get(id: string, actor = admin) {
      return (await request(app).get(`${root}/${id}`).set(actor.headers).expect(200)).body
        .data;
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
      expect(
        (
          await prisma.$queryRaw<
            { rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }[]
          >`SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user`
        )[0],
      ).toEqual({ rolsuper: false, rolcreatedb: false, rolcreaterole: false });
      const base = JSON.parse(
        readFileSync(process.env.WORK_STAFF_DIRECTORY_FIXTURES!, "utf8"),
      );
      originals.push(
        ...(await prisma.user.findMany({ select: { id: true } })).map((v) => v.id),
      );
      beforeHash = await protectedRows();
      const branches = await prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true },
        take: 2,
        orderBy: { id: "asc" },
      });
      expect(branches).toHaveLength(2);
      branchId = branches[0]!.id;
      secondBranch = branches[1]!.id;
      for (const role of ["STAFF", "ADMIN", "STAFF"] as const) {
        const u = await prisma.user.create({
          data: {
            email: `staff-detail-${randomUUID()}@example.test`,
            passwordHash: "unusable-isolated-test-only",
            role,
            emailVerifiedAt: new Date(),
            staffProfile: {
              create: {
                firstName: "Synthetic",
                lastName: "Account",
                branchId,
                jobTitle: "Account-detail verification",
              },
            },
          },
        });
        created.push(u.id);
      }
      [staffId, adminId, raceId] = created as [string, string, string];
      admin = await auth(base.admin);
      owner = await auth(base.owner);
      target = await auth(staffId);
      writeFileSync(
        process.env.WORK_STAFF_ACCOUNT_FIXTURES!,
        JSON.stringify(
          {
            admin: admin.id,
            owner: owner.id,
            staffId,
            adminId,
            raceId,
            branchId,
            secondBranch,
            created,
          },
          null,
          2,
        ),
      );
    });
    afterAll(async () => {
      expect(await protectedRows()).toBe(beforeHash);
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
    });
    it("checks account revisions atomically, preserves status/branch rules and revokes only target sessions", async () => {
      const initial = await get(staffId),
        expectedRevision = revision(initial);
      const read = await request(app)
        .get(`${root}/${staffId}`)
        .set(admin.headers)
        .expect(200);
      expect(read.headers["cache-control"]).toBe("private, no-store");
      await request(app)
        .patch(`${root}/${staffId}/status`)
        .set({ Cookie: admin.headers.Cookie!, Origin: admin.headers.Origin! })
        .send({ status: "SUSPENDED", expectedRevision })
        .expect(403);
      const changed = await request(app)
        .patch(`${root}/${staffId}/status`)
        .set(admin.headers)
        .send({ status: "SUSPENDED", expectedRevision })
        .expect(200);
      expect(changed.body.data).toEqual({ id: staffId, status: "SUSPENDED" });
      const suspended = await get(staffId);
      expect(suspended.status).toBe("SUSPENDED");
      expect(
        (await prisma.session.findUniqueOrThrow({ where: { id: target.sessionId } }))
          .revokedAt,
      ).not.toBeNull();
      expect(
        (await prisma.session.findUniqueOrThrow({ where: { id: admin.sessionId } }))
          .revokedAt,
      ).toBeNull();
      await request(app)
        .patch(`${root}/${staffId}/status`)
        .set(admin.headers)
        .send({ status: "ACTIVE", expectedRevision })
        .expect(409);
      await request(app)
        .patch(`${root}/${staffId}/branch`)
        .set(admin.headers)
        .send({ branchId: secondBranch, expectedRevision })
        .expect(409);
      const current = revision(suspended);
      const branch = await request(app)
        .patch(`${root}/${staffId}/branch`)
        .set(admin.headers)
        .send({ branchId: secondBranch, expectedRevision: current })
        .expect(200);
      expect(branch.body.data).toEqual({
        id: initial.staffProfile.id,
        branchId: secondBranch,
      });
      await request(app)
        .patch(`${root}/${staffId}/status`)
        .set(admin.headers)
        .send({ status: "ACTIVE", expectedRevision: revision(await get(staffId)) })
        .expect(200);
      await request(app)
        .patch(`${root}/${admin.id}/status`)
        .set(admin.headers)
        .send({ status: "SUSPENDED" })
        .expect(403);
      await request(app)
        .patch(`${root}/${owner.id}/status`)
        .set(admin.headers)
        .send({ status: "SUSPENDED" })
        .expect(403);
      await request(app)
        .patch(`${root}/${staffId}/status`)
        .set(admin.headers)
        .send({ status: "ACTIVE", expectedRevision: "" })
        .expect(422);
    });
    it("allows only one concurrent mutation for the same account revision and preserves demotion restrictions", async () => {
      const expectedRevision = revision(await get(raceId));
      const responses = await Promise.all([
        request(app)
          .patch(`${root}/${raceId}/status`)
          .set(admin.headers)
          .send({ status: "SUSPENDED", expectedRevision }),
        request(app)
          .patch(`${root}/${raceId}/branch`)
          .set(admin.headers)
          .send({ branchId: secondBranch, expectedRevision }),
      ]);
      expect(responses.map((v) => v.status).sort()).toEqual([200, 409]);
      const prior = await get(adminId, owner),
        body = {
          role: "STAFF",
          branchId: secondBranch,
          expectedRevision: revision(prior),
        };
      await request(app)
        .patch(`${root}/${adminId}/role`)
        .set(admin.headers)
        .send(body)
        .expect(403);
      const result = await request(app)
        .patch(`${root}/${adminId}/role`)
        .set(owner.headers)
        .send(body)
        .expect(200);
      expect(result.body.data.role).toBe("STAFF");
      expect(result.body.data.staffProfile.branchId).toBe(secondBranch);
      await request(app)
        .patch(`${root}/${adminId}/role`)
        .set(owner.headers)
        .send(body)
        .expect(403);
      await request(app)
        .patch(`${root}/${staffId}/role`)
        .set(owner.headers)
        .send({ role: "ADMIN", branchId })
        .expect(422);
    });
    it("audits private capability reads and confirms supported grant/revoke receipts without changing existing grants", async () => {
      const path = "/api/v1/admin/capabilities",
        query = `?userId=${staffId}&activeOnly=true`;
      await request(app)
        .get(path + query)
        .set(admin.headers)
        .expect(403);
      await request(app)
        .get(path + query)
        .expect(401);
      const before = await prisma.auditLog.count({
        where: { action: "READ", entityType: "USER", entityId: staffId },
      });
      const initial = await request(app)
        .get(path + query)
        .set(owner.headers)
        .expect(200);
      expect(initial.headers["cache-control"]).toBe("private, no-store");
      expect(initial.body.data).toEqual([]);
      expect(
        await prisma.auditLog.count({
          where: { action: "READ", entityType: "USER", entityId: staffId },
        }),
      ).toBe(before + 1);
      const grant = await request(app)
        .post(path)
        .set(owner.headers)
        .send({ userId: staffId, capability: "BOOKING_CONFIRM" })
        .expect(201);
      expect(Object.keys(grant.body.data).sort()).toEqual(
        [
          "id",
          "userId",
          "capability",
          "grantedByUserId",
          "grantedAt",
          "revokedAt",
        ].sort(),
      );
      expect(grant.body.data).toMatchObject({
        userId: staffId,
        capability: "BOOKING_CONFIRM",
        revokedAt: null,
      });
      const revoke = await request(app)
        .post(`${path}/${grant.body.data.id}/revoke`)
        .set(owner.headers)
        .send({ reason: "Synthetic duty verification completed" })
        .expect(200);
      expect(revoke.body.data).toEqual({ id: grant.body.data.id, revoked: true });
      expect(
        (
          await request(app)
            .get(path + query)
            .set(owner.headers)
            .expect(200)
        ).body.data,
      ).toEqual([]);
      const history = await request(app)
        .get(path + `?userId=${staffId}`)
        .set(owner.headers)
        .expect(200);
      expect(history.body.data).toHaveLength(1);
      expect(history.body.data[0].revokedAt).not.toBeNull();
      expect(await protectedRows()).toBe(beforeHash);
    });
  },
);
