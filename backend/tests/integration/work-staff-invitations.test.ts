import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
const app = createApp({ checkReadiness: async () => undefined });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "private invitation inspection and candidate eligibility",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let owner: Actor,
      admin: Actor,
      enrolled: Actor,
      staffId: string,
      missingId: string,
      inactiveId: string,
      hashBefore: string;
    const sessions: string[] = [],
      originalUsers: string[] = [],
      originalInvitations: string[] = [],
      addedInvitations: string[] = [];
    const hash = (v: unknown) =>
      createHash("sha256").update(JSON.stringify(v)).digest("hex");
    const snapshot = () =>
      Promise.all([
        prisma.user.findMany({
          where: { id: { in: originalUsers } },
          orderBy: { id: "asc" },
        }),
        prisma.staffProfile.findMany({
          where: { userId: { in: originalUsers } },
          orderBy: { id: "asc" },
        }),
        prisma.privilegedInvitation.findMany({
          where: { id: { in: originalInvitations } },
          orderBy: { id: "asc" },
        }),
        prisma.outboxEvent.findMany({ orderBy: { id: "asc" } }),
        prisma.userCapability.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
      ]);
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
            { rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }[]
          >`SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user`
        )[0],
      ).toEqual({ rolsuper: false, rolcreatedb: false, rolcreaterole: false });
      const base = JSON.parse(
        readFileSync(process.env.WORK_STAFF_WORKFORCE_FIXTURES!, "utf8"),
      );
      staffId = base.staffId;
      missingId = base.missingId;
      inactiveId = base.inactiveId;
      originalUsers.push(
        ...(await prisma.user.findMany({ select: { id: true } })).map((v) => v.id),
      );
      originalInvitations.push(
        ...(await prisma.privilegedInvitation.findMany({ select: { id: true } })).map(
          (v) => v.id,
        ),
      );
      hashBefore = hash(await snapshot());
      const previousActor = await prisma.user.findFirst({
        where: {
          email: { startsWith: "invitation-inspection-" },
          role: "ADMIN",
          staffProfile: { lastName: "Invitation reviewer" },
        },
      });
      const actor =
        previousActor ??
        (await prisma.user.create({
          data: {
            email: `invitation-inspection-${randomUUID()}@example.test`,
            passwordHash: "unusable-isolated-test-only",
            role: "ADMIN",
            emailVerifiedAt: new Date(),
            staffProfile: {
              create: {
                firstName: "Synthetic",
                lastName: "Invitation reviewer",
                branchId: base.branchId,
              },
            },
          },
        }));
      owner = await auth(base.owner);
      admin = await auth(actor.id);
      enrolled = await auth(base.adminId);
      // Expiry does not release the unused-recipient uniqueness constraint.
      // Preserve the retained pending invitation and give the expired fixture its own recipient.
      const expiredRecipient =
        (await prisma.user.findUnique({
          where: { email: "invitation-expired-recipient@example.test" },
        })) ??
        (await prisma.user.create({
          data: {
            email: "invitation-expired-recipient@example.test",
            passwordHash: "unusable-isolated-test-only",
            role: "STAFF",
            emailVerifiedAt: new Date(),
            staffProfile: {
              create: {
                firstName: "Synthetic",
                lastName: "Expired recipient",
                branchId: base.branchId,
              },
            },
          },
        }));
      for (let n = 0; n < 4; n++) {
        const recipientId = n === 1 ? expiredRecipient.id : staffId;
        const previous = await prisma.privilegedInvitation.findFirst({
          where: {
            email: { startsWith: "invitation-recipient-" },
            recipientId,
            invitedById: n < 2 ? admin.id : owner.id,
            usedAt: n === 2 ? { not: null } : null,
            revokedAt: n === 3 ? { not: null } : null,
            expiresAt: n === 1 ? { lt: new Date() } : { gt: new Date() },
          },
        });
        const row =
          previous ??
          (await prisma.privilegedInvitation.create({
            data: {
              email: `invitation-recipient-${randomUUID()}@example.test`,
              role: "ADMIN",
              recipientId,
              invitedById: n < 2 ? admin.id : owner.id,
              tokenHash: hashToken("privileged-invitation", randomUUID()),
              createdAt: new Date(Date.now() - 120000),
              expiresAt: new Date(Date.now() + (n === 1 ? -60000 : 3600000)),
              usedAt: n === 2 ? new Date() : null,
              revokedAt: n === 3 ? new Date() : null,
            },
          }));
        addedInvitations.push(row.id);
      }
      writeFileSync(
        process.env.WORK_STAFF_INVITATIONS_FIXTURES!,
        JSON.stringify(
          {
            owner: owner.id,
            admin: admin.id,
            enrolled: enrolled.id,
            staffId,
            addedInvitations,
          },
          null,
          2,
        ),
      );
    });
    afterAll(async () => {
      try {
        expect(hash(await snapshot())).toBe(hashBefore);
      } finally {
        await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      }
    });
    it("returns eligible active branch facts and suppresses impossible account actions", async () => {
      const search = async (userId: string) => {
        const { email } = await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { email: true },
        });
        const r = await request(app)
          .get("/api/v1/admin/staff/candidates")
          .query({ email })
          .set(owner.headers)
          .expect(200);
        expect(r.headers["cache-control"]).toBe("private, no-store");
        return r.body.data.items;
      };
      const staff = (await search(staffId))[0];
      expect(staff.management).toEqual({ canPromote: false, canInvite: true });
      expect(staff.staffProfile.branch.isActive).toBe(true);
      expect(staff).not.toHaveProperty("workforceAccess");
      expect(staff).not.toHaveProperty("passwordHash");
      expect((await search(missingId))[0].management).toEqual({
        canPromote: false,
        canInvite: false,
      });
      expect(await search(inactiveId)).toEqual([]);
      const { email } = await prisma.user.findUniqueOrThrow({
        where: { id: staffId },
        select: { email: true },
      });
      await request(app)
        .get("/api/v1/admin/staff/candidates")
        .query({ email })
        .set(enrolled.headers)
        .expect(403);
    });
    it("preserves Admin ownership and owner visibility for private audited invitation details", async () => {
      const list = await request(app)
        .get("/api/v1/admin/staff/invitations")
        .query({ limit: 25 })
        .set(admin.headers)
        .expect(200);
      expect(list.headers["cache-control"]).toBe("private, no-store");
      expect(list.body.data.items.map((v: { id: string }) => v.id).sort()).toEqual(
        addedInvitations.slice(0, 2).sort(),
      );
      for (const [n, id] of addedInvitations.entries()) {
        const r = await request(app)
          .get(`/api/v1/admin/staff/invitations/${id}`)
          .set(owner.headers)
          .expect(200);
        expect(r.headers["cache-control"]).toBe("private, no-store");
        expect(r.body.data.status).toBe(["PENDING", "EXPIRED", "ACCEPTED", "REVOKED"][n]);
        expect(Object.keys(r.body.data).sort()).toEqual(
          [
            "id",
            "email",
            "role",
            "recipientId",
            "invitedById",
            "createdAt",
            "expiresAt",
            "usedAt",
            "revokedAt",
            "status",
          ].sort(),
        );
        await request(app)
          .get(`/api/v1/admin/staff/invitations/${id}`)
          .set(admin.headers)
          .expect(n < 2 ? 200 : 404);
      }
      expect(
        await prisma.auditLog.count({
          where: {
            userId: owner.id,
            entityType: "PRIVILEGED_INVITATION",
            entityId: { in: addedInvitations },
            action: "READ",
          },
        }),
      ).toBe(4);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: admin.id,
            entityType: "PRIVILEGED_INVITATION",
            entityId: { in: addedInvitations.slice(2) },
            action: "READ",
          },
        }),
      ).toBe(0);
      expect(hash(await snapshot())).toBe(hashBefore);
    });
  },
);
