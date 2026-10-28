import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  workforceTemplates,
  type Template,
} from "../../src/modules/organization/workforce.policy.js";

const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
const root = "/api/v1/staff/notifications";
type Identity = {
  userId: string;
  sessionId: string;
  notificationId: string;
  headers: Record<string, string>;
};
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "managed workforce personal notifications over HTTP",
  () => {
    const sessions: string[] = [];
    const identities: Identity[] = [];
    let owner: string, branch: string, before: string;
    let originalIds: Set<string>[];
    let unassigned: Identity, admin: Identity, customer: Identity, legacy: Identity;
    const evidence = process.env.WORKFORCE_NOTIFICATIONS_FIXTURES!;
    let guarded = false;
    const rows = () =>
      Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.businessPolicyVersion.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.notification.findMany({ orderBy: { id: "asc" } }),
        prisma.notificationPreference.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
        prisma.auditLog.findMany({ orderBy: { id: "asc" } }),
      ]);
    const digest = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    async function auth(userId: string, mfa = true) {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiresAt = new Date(Date.now() + 3600000);
      const session = await prisma.session.create({
        data: {
          userId,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          expiresAt,
          idleExpiresAt: expiresAt,
          mfaRequired: true,
          mfaVerifiedAt: mfa ? new Date() : null,
          createdAt: new Date(Date.now() - 1000),
        },
      });
      sessions.push(session.id);
      return {
        sessionId: session.id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "X-CSRF-Token": csrf,
        },
      };
    }
    async function account(
      template: Template | null,
      role: "STAFF" | "ADMIN" | "CUSTOMER" = "STAFF",
      managed = true,
    ) {
      const user = await prisma.user.create({
        data: {
          email: `workforce-notifications-${randomUUID()}@example.test`,
          role,
          emailVerifiedAt: new Date(),
          passwordHash: "unusable-synthetic-fixture",
          ...(role === "CUSTOMER"
            ? {
                profile: {
                  create: {
                    firstName: "Synthetic",
                    lastName: "Notifications",
                    phone: "+2348000000000",
                  },
                },
              }
            : {
                staffProfile: {
                  create: {
                    firstName: "Synthetic",
                    lastName: "Notifications",
                    branchId: branch,
                  },
                },
              }),
        },
      });
      if (managed) {
        await prisma.workforceAccess.create({
          data: {
            userId: user.id,
            position: template ?? "MECHANICAL_TECHNICIAN",
            updatedByUserId: owner,
          },
        });
        if (template)
          await prisma.workforceAssignment.create({
            data: {
              userId: user.id,
              template,
              branchId: branch,
              scope: workforceTemplates[template].scope,
              startsAt: new Date(Date.now() - 1000),
              reason: "Isolated notification integration fixture",
              assignedByUserId: owner,
            },
          });
      }
      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          type: "SYSTEM",
          category: "SECURITY",
          title: "Synthetic account update",
          message: "Isolated notification ownership check",
          deduplicationKey: `workforce-notifications:${randomUUID()}`,
        },
      });
      return {
        userId: user.id,
        notificationId: notification.id,
        ...(await auth(user.id)),
      };
    }
    const get = (f: Identity, path = root) => request(app).get(path).set(f.headers);
    const post = (f: Identity, path: string, body: unknown = {}) =>
      request(app).post(path).set(f.headers).send(body);
    const key = () => `preference-v1.${Date.now()}.${randomUUID()}`;
    const put = (f: Identity, body: unknown, requestKey = key()) =>
      request(app)
        .put(`${root}/preferences/current`)
        .set(f.headers)
        .set("Idempotency-Key", requestKey)
        .send(body);
    beforeAll(async () => {
      expect(
        await prisma.$queryRaw`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`,
      ).toEqual([
        {
          database: "allied_work_staff_workforce_20261019_test",
          host: "127.0.0.1",
          port: 55480,
        },
      ]);
      expect(env.NODE_ENV).toBe("test");
      expect(
        await prisma.$queryRaw`SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS elevated FROM pg_roles WHERE rolname=current_user`,
      ).toEqual([{ elevated: false }]);
      if (existsSync(evidence))
        throw Error(
          "Retained notification fixtures exist; inspect the original outcome before continuing. Do not replay setup.",
        );
      owner = JSON.parse(
        readFileSync(process.env.WORK_STAFF_WORKFORCE_FIXTURES!, "utf8"),
      ).owner;
      branch = (
        await prisma.branch.findFirstOrThrow({
          where: { isActive: true },
          select: { id: true },
        })
      ).id;
      const original = await rows();
      originalIds = original.map(
        (table) => new Set(table.map((row) => ("id" in row ? row.id : row.userId))),
      );
      before = digest(original);
      writeFileSync(
        evidence,
        JSON.stringify({
          phase: "setup",
          before,
          originalCounts: original.map((table) => table.length),
        }),
      );
      guarded = true;
      if (process.env.WORKFORCE_NOTIFICATIONS_RECEIPT_ONLY === "true") {
        admin = await account("OPERATIONS", "ADMIN");
        writeFileSync(
          evidence,
          JSON.stringify({
            phase: "receipt-fixture-created",
            before,
            userId: admin.userId,
          }),
        );
        return;
      }
      for (const template of Object.keys(workforceTemplates) as Template[])
        identities.push(await account(template));
      admin = await account("OPERATIONS", "ADMIN");
      unassigned = await account(null);
      customer = await account(null, "CUSTOMER", false);
      legacy = await account(null, "STAFF", false);
      writeFileSync(
        evidence,
        JSON.stringify({
          phase: "fixtures-created",
          before,
          users: [...identities, admin, unassigned, customer, legacy].map(
            ({ userId, notificationId }) => ({ userId, notificationId }),
          ),
        }),
      );
    }, 30000);

    it("all eight responsibilities and managed Admin read only their own private notifications", async () => {
      for (const f of [...identities, admin, unassigned]) {
        const response = await get(f);
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("private, no-store");
        expect(response.body.data.items.map((row: { id: string }) => row.id)).toEqual([
          f.notificationId,
        ]);
        expect(response.body.data.items[0]).not.toHaveProperty("userId");
        expect(response.body.data.items[0]).not.toHaveProperty("deduplicationKey");
        expect((await get(f, `${root}/preferences/current`)).body.data).toEqual({
          immutableCategories: ["SECURITY", "TRANSACTIONAL"],
          preferences: [],
        });
        expect((await get(f, "/api/v1/staff/payments")).status).toBe(403);
      }
    });

    it("ownership and strict validation prevent changing another account or expanding the exception", async () => {
      const f = identities[0]!,
        other = identities[1]!;
      expect((await post(f, `${root}/${other.notificationId}/read`)).status).toBe(404);
      expect((await get(f, `${root}?userId=${other.userId}`)).status).toBe(422);
      expect((await post(f, `${root}/read-all`, { userId: other.userId })).status).toBe(
        422,
      );
      for (const path of [
        `${root}/export`,
        `${root}/preferences/current/export`,
        "/api/v1/staff/bookings",
        "/api/v1/admin/users",
      ])
        expect((await get(f, path)).status).toBe(403);
      expect((await post(f, `${root}/${f.notificationId}/read`)).status).toBe(200);
      expect((await post(f, `${root}/read-all`)).body.data).toEqual({ updated: 0 });
      expect(
        (
          await prisma.notification.findUniqueOrThrow({
            where: { id: other.notificationId },
          })
        ).readAt,
      ).toBeNull();
    });

    it("preference receipts preserve later withdrawal and never widen immutable categories", async () => {
      const f = admin,
        originalKey = key(),
        body = {
          category: "MARKETING",
          channel: "EMAIL",
          enabled: true,
          expectedVersion: 0,
        };
      const first = await put(f, body, originalKey);
      expect(first.status).toBe(200);
      expect(first.body.data).toMatchObject({
        appliedVersion: 1,
        replayed: false,
        preference: { version: 1, enabled: true },
      });
      expect((await put(f, { ...body, enabled: false, expectedVersion: 1 })).status).toBe(
        200,
      );
      const replay = await put(f, body, originalKey);
      expect(replay.status).toBe(200);
      expect(replay.body.data).toMatchObject({
        appliedVersion: 1,
        replayed: true,
        preference: {
          version: 2,
          enabled: false,
          consentedAt: first.body.data.preference.consentedAt,
        },
      });
      expect((await put(f, { ...body, enabled: false }, originalKey)).status).toBe(409);
      expect((await put(f, { ...body, category: "SECURITY" })).status).toBe(422);
      expect(await prisma.consentRecord.count({ where: { userId: f.userId } })).toBe(2);
      expect(
        await prisma.idempotencyRecord.count({
          where: { scope: `notification-preference:${f.userId}` },
        }),
      ).toBe(2);
      expect(
        await prisma.auditLog.count({
          where: { userId: f.userId, action: "UPDATE", entityType: "USER" },
        }),
      ).toBe(2);
    });

    it("MFA, CSRF, session revocation and suspension still deny personal endpoints", async () => {
      const f = unassigned;
      const weak = { ...f, ...(await auth(f.userId, false)) };
      expect((await get(weak)).status).toBe(403);
      expect(
        (
          await request(app)
            .post(`${root}/read-all`)
            .set("Cookie", f.headers.Cookie!)
            .set("Origin", env.FRONTEND_URL[0]!)
            .send({})
        ).status,
      ).toBe(403);
      const revoked = { ...f, ...(await auth(f.userId)) };
      await prisma.session.update({
        where: { id: revoked.sessionId },
        data: { revokedAt: new Date() },
      });
      expect((await get(revoked)).status).toBe(401);
      await prisma.user.update({
        where: { id: f.userId },
        data: { status: "SUSPENDED" },
      });
      expect((await get(f)).status).toBe(401);
    });

    it("revoked responsibilities keep personal access while operational queues remain forbidden", async () => {
      const f = identities[7]!;
      await prisma.workforceAssignment.updateMany({
        where: { userId: f.userId },
        data: {
          revokedAt: new Date(),
          revokedByUserId: owner,
          revocationReason: "Synthetic responsibility revoked",
        },
      });
      expect((await get(f)).status).toBe(200);
      expect((await get(f, "/api/v1/staff/workforce/jobs")).status).toBe(403);
      expect((await get(f, "/api/v1/staff/bookings")).status).toBe(403);
    });

    it("legacy staff and customer account routes retain their own role boundaries", async () => {
      expect((await get(legacy)).status).toBe(200);
      expect((await get(customer)).status).toBe(403);
      const response = await get(customer, "/api/v1/customers/notifications");
      expect(response.status).toBe(200);
      expect(response.body.data.items.map((row: { id: string }) => row.id)).toEqual([
        customer.notificationId,
      ]);
      expect((await get(admin, "/api/v1/customers/notifications")).status).toBe(403);
    });

    afterAll(async () => {
      try {
        if (guarded) {
          await prisma.session.deleteMany({ where: { id: { in: sessions } } });
          const after = (await rows()).map((table, index) =>
            table.filter((row) =>
              originalIds[index]!.has("id" in row ? row.id : row.userId),
            ),
          );
          const originalRowsUnchanged = digest(after) === before;
          writeFileSync(
            evidence.replace("fixtures.json", "preservation.json"),
            JSON.stringify({
              originalRowsUnchanged,
              originalCounts: after.map((table) => table.length),
              temporarySessionsRemaining: await prisma.session.count({
                where: { id: { in: sessions } },
              }),
            }),
          );
          expect(originalRowsUnchanged).toBe(true);
        }
      } finally {
        await prisma.$disconnect();
      }
    });
  },
);
