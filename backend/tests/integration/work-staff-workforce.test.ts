import { randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { fixturePassword } from "../fixtures/workforce.js";
const app = createApp({ checkReadiness: async () => undefined }),
  root = "/api/v1/admin/workforce/accounts";
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "staff responsibility management contract",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let owner: Actor,
      delegated: Actor,
      staffId: string,
      adminId: string,
      inactiveId: string,
      missingId: string,
      branchId: string,
      secondBranch: string,
      initialHash: string;
    const password = fixturePassword,
      sessions: string[] = [],
      originals: string[] = [],
      created: string[] = [];
    const proof = (expectedVersion: number | null) => ({
      expectedVersion,
      reason: "Synthetic reviewed responsibility change",
      currentPassword: password,
    });
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
          prisma.workforceAccess.findMany({
            where: { userId: { in: originals } },
            orderBy: { userId: "asc" },
          }),
          prisma.workforceAssignment.findMany({
            where: { userId: { in: originals } },
            orderBy: { id: "asc" },
          }),
          prisma.userCapability.findMany({ orderBy: { id: "asc" } }),
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
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "x-csrf-token": csrf,
        },
      };
    }
    beforeAll(async () => {
      const [actual] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(actual).toEqual({
        database: "allied_work_staff_workforce_20261019_test",
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
      originals.push(
        ...(await prisma.user.findMany({ select: { id: true } })).map((v) => v.id),
      );
      expect(await prisma.user.count({ where: { role: "SUPER_ADMIN" } })).toBe(0);
      for (const name of ["Stadium synthetic workshop", "GRA synthetic workshop"]) {
        await prisma.branch.create({
          data: {
            name,
            code: `WF-${randomUUID().slice(0, 8)}`,
            address: "Synthetic test address",
            city: "Port Harcourt",
            state: "Rivers",
          },
        });
      }
      initialHash = await protectedRows();
      const branches = await prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true },
        orderBy: { id: "asc" },
        take: 2,
      });
      expect(branches).toHaveLength(2);
      branchId = branches[0]!.id;
      secondBranch = branches[1]!.id;
      const passwordHash = await hashPassword(password);
      for (let n = 0; n < 5; n++) {
        const u = await prisma.user.create({
          data: {
            email: `responsibility-${randomUUID()}@example.test`,
            passwordHash,
            role: n === 0 ? "SUPER_ADMIN" : n === 2 ? "ADMIN" : "STAFF",
            status: n === 3 ? "SUSPENDED" : "ACTIVE",
            emailVerifiedAt: new Date(),
            ...(n === 4
              ? {}
              : {
                  staffProfile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: `Responsibility ${n}`,
                      branchId,
                    },
                  },
                }),
          },
        });
        created.push(u.id);
      }
      owner = await auth(created[0]!);
      staffId = created[1]!;
      adminId = created[2]!;
      inactiveId = created[3]!;
      missingId = created[4]!;
      writeFileSync(
        process.env.WORK_STAFF_WORKFORCE_FIXTURES!,
        JSON.stringify(
          {
            owner: owner.id,
            staffId,
            adminId,
            inactiveId,
            missingId,
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
      try {
        expect(await protectedRows()).toBe(initialHash);
      } finally {
        await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      }
    });
    it("returns private management eligibility without exposing impossible protected or inactive actions", async () => {
      for (const id of [owner.id, inactiveId, missingId]) {
        const r = await request(app).get(`${root}/${id}`).set(owner.headers).expect(200);
        expect(r.headers["cache-control"]).toBe("private, no-store");
        expect(r.body.data.management).toMatchObject({
          canEnroll: false,
          canAssign: false,
          canRevoke: false,
          canDelegate: false,
        });
        await request(app)
          .put(`${root}/${id}`)
          .set(owner.headers)
          .send({ ...proof(null), position: "WORKSHOP_LEAD" })
          .expect(403);
      }
      const normal = await request(app)
        .get(`${root}/${staffId}`)
        .set(owner.headers)
        .expect(200);
      expect(normal.body.data).toMatchObject({
        userId: staffId,
        accountLabel: "Synthetic Responsibility 1",
        management: {
          canEnroll: true,
          canAssign: false,
          canRevoke: false,
          canDelegate: false,
          branchIds: null,
        },
      });
      await request(app)
        .put(`${root}/${staffId}`)
        .set(owner.headers)
        .send({
          ...proof(null),
          currentPassword: "incorrect synthetic proof",
          position: "WORKSHOP_LEAD",
        })
        .expect(403);
      await request(app)
        .put(`${root}/${staffId}`)
        .set({ Cookie: owner.headers.Cookie!, Origin: owner.headers.Origin! })
        .send({ ...proof(null), position: "WORKSHOP_LEAD" })
        .expect(403);
    });
    it("enrolls, assigns and revokes with exact receipts, branch references and version checks", async () => {
      const enrollment = await request(app)
        .put(`${root}/${staffId}`)
        .set(owner.headers)
        .send({ ...proof(null), position: "WORKSHOP_LEAD" })
        .expect(200);
      expect(enrollment.body.data).toMatchObject({
        userId: staffId,
        position: "WORKSHOP_LEAD",
        version: 0,
        updatedByUserId: owner.id,
        delegatedTemplates: [],
        delegatedBranchIds: [],
      });
      const body = {
        ...proof(0),
        template: "WORKSHOP_LEAD",
        branchId,
        temporary: true,
        startsAt: new Date(Date.now() - 60000).toISOString(),
        expiresAt: null,
      };
      const assignment = await request(app)
        .post(`${root}/${staffId}/assignments`)
        .set(owner.headers)
        .send(body)
        .expect(200);
      expect(assignment.body.data).toMatchObject({
        userId: staffId,
        template: body.template,
        branchId,
        temporary: true,
        startsAt: body.startsAt,
        expiresAt: null,
        reason: body.reason,
        assignedByUserId: owner.id,
        scope: "BRANCH",
        revokedAt: null,
      });
      const active = await request(app)
        .get(`${root}/${staffId}`)
        .set(owner.headers)
        .expect(200);
      expect(active.body.data.management).toMatchObject({
        canEnroll: true,
        canAssign: true,
        canRevoke: true,
        canDelegate: false,
      });
      expect(active.body.data.activeAssignmentIds).toContain(assignment.body.data.id);
      expect(active.body.data.branches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: branchId, isActive: true }),
        ]),
      );
      await request(app)
        .post(`${root}/${staffId}/assignments`)
        .set(owner.headers)
        .send(body)
        .expect(409);
      const revoked = await request(app)
        .post(`${root}/${staffId}/assignments/${assignment.body.data.id}/revoke`)
        .set(owner.headers)
        .send(proof(1))
        .expect(200);
      expect(revoked.body.data).toMatchObject({
        id: assignment.body.data.id,
        revokedByUserId: owner.id,
        revocationReason: proof(1).reason,
      });
      expect(revoked.body.data.revokedAt).not.toBeNull();
      expect(
        (await prisma.workforceAccess.findUniqueOrThrow({ where: { userId: staffId } }))
          .version,
      ).toBe(2);
    });
    it("limits delegated administrator inspection and assignments to the approved templates and branches", async () => {
      await request(app)
        .put(`${root}/${adminId}`)
        .set(owner.headers)
        .send({ ...proof(null), position: "OPERATIONS" })
        .expect(200);
      const envelope = await request(app)
        .put(`${root}/${adminId}/delegation`)
        .set(owner.headers)
        .send({
          ...proof(0),
          templates: ["WORKSHOP_LEAD"],
          branchIds: [branchId],
          allowAdminInvitations: false,
        })
        .expect(200);
      expect(envelope.body.data).toMatchObject({
        userId: adminId,
        version: 1,
        delegatedTemplates: ["WORKSHOP_LEAD"],
        delegatedBranchIds: [branchId],
        updatedByUserId: owner.id,
      });
      delegated = await auth(adminId);
      const scoped = await request(app)
        .get(`${root}/${staffId}`)
        .set(delegated.headers)
        .expect(200);
      expect(scoped.body.data.management).toEqual({
        canEnroll: false,
        canAssign: true,
        canRevoke: true,
        canDelegate: false,
        templates: ["WORKSHOP_LEAD"],
        branchIds: [branchId],
      });
      const body = {
        ...proof(2),
        template: "WORKSHOP_LEAD",
        branchId,
        temporary: false,
        startsAt: new Date().toISOString(),
        expiresAt: null,
      };
      await request(app)
        .post(`${root}/${staffId}/assignments`)
        .set(delegated.headers)
        .send({ ...body, branchId: secondBranch })
        .expect(403);
      await request(app)
        .post(`${root}/${staffId}/assignments`)
        .set(delegated.headers)
        .send({ ...body, template: "ACCOUNTANT" })
        .expect(403);
      await request(app)
        .post(`${root}/${staffId}/assignments`)
        .set(delegated.headers)
        .send(body)
        .expect(200);
      await request(app)
        .put(`${root}/${staffId}/delegation`)
        .set(delegated.headers)
        .send({ ...proof(3), templates: [], branchIds: [], allowAdminInvitations: false })
        .expect(403);
      expect(await protectedRows()).toBe(initialHash);
    });
  },
);
