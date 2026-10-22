import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { testOwner } from "../helpers/owner.js";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
const app = createApp({ checkReadiness: async () => undefined }),
  sessions: string[] = [];
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "workshop review moderation",
  () => {
    let admin: { id: string; headers: Record<string, string> },
      staff: typeof admin,
      customer: typeof admin,
      superAdmin: typeof admin,
      unverified: typeof admin;
    const paging: string[] = [],
      customers: string[] = [];
    async function auth(id: string, role: string, assured = true) {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiry = new Date(Date.now() + 3600000),
        session = await prisma.session.create({
          data: {
            userId: id,
            createdAt: new Date(Date.now() - 1000),
            tokenHash: hashToken("session", token),
            csrfTokenHash: hashToken("csrf", csrf),
            expiresAt: expiry,
            idleExpiresAt: expiry,
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
          email: `moderation-api-${randomUUID()}@example.test`,
          passwordHash: "unusable-qa-only",
          role,
          emailVerifiedAt: new Date(),
          ...(role === "CUSTOMER"
            ? {
                profile: {
                  create: {
                    firstName: "Moderation",
                    lastName: "Customer",
                    phone: "+2348000000000",
                  },
                },
              }
            : {
                staffProfile: {
                  create: { firstName: "Moderation", lastName: "Administrator" },
                },
              }),
        },
        include: { profile: true },
      });
      return { user, actor: await auth(user.id, role) };
    }
    const get = (path: string, actor = admin) =>
        request(app).get(`/api/v1${path}`).set(actor.headers),
      post = (id: string, body: unknown, actor = admin) =>
        request(app)
          .post(`/api/v1/staff/support/reviews/${id}/moderation`)
          .set(actor.headers)
          .send(body);
    async function makeReview(note: string | null = null) {
      const person = await account("CUSTOMER");
      return prisma.review.create({
        data: {
          customerId: person.user.profile!.id,
          targetType: "BUSINESS",
          rating: 4,
          title: "Synthetic moderation decision",
          comment: "Synthetic customer review content",
          moderationNote: note,
        },
      });
    }
    beforeAll(async () => {
      const [actual] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(actual).toEqual({
        database: env.DB_NAME,
        host: env.DB_HOST,
        port: env.DB_PORT,
      });
      expect(actual?.database).toMatch(/_(test|ci)$/);
      const fixturePath = process.env.WORK_MODERATION_FIXTURES;
      const reused =
        process.env.WORK_MODERATION_REUSE_FIXTURES === "true" &&
        fixturePath &&
        existsSync(fixturePath)
          ? (JSON.parse(readFileSync(fixturePath, "utf8")) as {
              admin: string;
              staff: string;
              customer: string;
              paging: string[];
              customers: string[];
            })
          : undefined;
      if (reused) {
        for (const [id, role] of [
          [reused.admin, "ADMIN"],
          [reused.staff, "STAFF"],
          [reused.customer, "CUSTOMER"],
        ]) {
          const user = await prisma.user.findUniqueOrThrow({ where: { id } });
          expect(
            user.role === role &&
              user.email.startsWith("moderation-api-") &&
              user.passwordHash === "unusable-qa-only",
          ).toBe(true);
        }
        expect(reused.paging).toHaveLength(28);
        expect(
          await prisma.review.count({
            where: {
              id: { in: reused.paging },
              targetType: "BUSINESS",
              status: "PENDING",
            },
          }),
        ).toBe(28);
        admin = await auth(reused.admin, "ADMIN");
        staff = await auth(reused.staff, "STAFF");
        customer = await auth(reused.customer, "CUSTOMER");
        paging.push(...reused.paging);
        customers.push(...reused.customers);
      } else {
        admin = (await account("ADMIN")).actor;
        staff = (await account("STAFF")).actor;
        customer = (await account("CUSTOMER")).actor;
      }
      unverified = await auth(admin.id, "ADMIN", false);
      const owner = await testOwner("unusable-qa-only");
      superAdmin = await auth(owner.id, "SUPER_ADMIN");
      for (let n = 0; !reused && n < 28; n++) {
        const person = await account("CUSTOMER");
        customers.push(person.user.profile!.id);
        const row = await prisma.review.create({
          data: {
            customerId: person.user.profile!.id,
            targetType: "BUSINESS",
            rating: (n % 5) + 1,
            title: `Synthetic moderation paging ${n}`,
            comment: "Synthetic moderation pagination feedback",
            createdAt: new Date(Date.UTC(1980, 0, 1, 9, 0, n, 123)),
          },
        });
        paging.push(row.id);
      }
      if (fixturePath)
        writeFileSync(
          fixturePath,
          JSON.stringify({
            admin: admin.id,
            staff: staff.id,
            customer: customer.id,
            superAdmin: superAdmin.id,
            paging,
            customers,
          }),
        );
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    it("preserves oldest-first paging, exact reference/type/status filters and private read audits", async () => {
      const readsBefore = await prisma.auditLog.count({
        where: { userId: admin.id, action: "READ", entityType: "REVIEW" },
      });
      const a = await get(
        "/staff/support/reviews?limit=25&targetType=BUSINESS&status=PENDING",
      );
      expect(a.status).toBe(200);
      expect(a.headers["cache-control"]).toBe("private, no-store");
      expect(a.body.data.items.map((r: { id: string }) => r.id)).toEqual(
        paging.slice(0, 25),
      );
      const b = await get(
        `/staff/support/reviews?limit=25&targetType=BUSINESS&status=PENDING&cursor=${a.body.data.nextCursor}`,
      );
      expect(b.status).toBe(200);
      expect(b.body.data.items.slice(0, 3).map((r: { id: string }) => r.id)).toEqual(
        paging.slice(25),
      );
      const exact = await get(
        `/staff/support/reviews?reviewId=${paging[27]}&targetType=BUSINESS&status=PENDING`,
      );
      expect(exact.body.data.items).toHaveLength(1);
      expect(exact.body.data.items[0].createdAt).toBe("1980-01-01T09:00:27.123Z");
      expect(
        (await get(`/staff/support/reviews?reviewId=${paging[27]}&targetType=SERVICE`))
          .body.data.items,
      ).toEqual([]);
      expect((await get("/staff/support/reviews?search=unsupported")).status).toBe(422);
      expect(
        await prisma.auditLog.count({
          where: { userId: admin.id, action: "READ", entityType: "REVIEW" },
        }),
      ).toBe(readsBefore + 4);
    });
    it("reads one complete review for administrators only and never exposes customer account secrets", async () => {
      const readsBefore = await prisma.auditLog.count({
        where: {
          userId: admin.id,
          action: "READ",
          entityType: "REVIEW",
          entityId: paging[0],
        },
      });
      const path = `/staff/support/reviews/${paging[0]}`,
        a = await get(path);
      expect(a.status).toBe(200);
      expect(a.headers["cache-control"]).toBe("private, no-store");
      expect(a.body.data).toMatchObject({
        id: paging[0],
        version: 0,
        status: "PENDING",
        customer: { firstName: "Moderation", lastName: "Customer" },
      });
      for (const field of ["customerId", "moderatedByUserId", "email", "userId"])
        expect(a.body.data).not.toHaveProperty(field);
      expect((await get(path, superAdmin)).status).toBe(200);
      for (const actor of [staff, customer, unverified])
        expect((await get(path, actor)).status).toBe(403);
      expect((await request(app).get(`/api/v1${path}`)).status).toBe(401);
      expect((await get(`/staff/support/reviews/${randomUUID()}`)).status).toBe(404);
      expect((await get(path + "?status=PENDING")).status).toBe(422);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: admin.id,
            action: "READ",
            entityType: "REVIEW",
            entityId: paging[0],
          },
        }),
      ).toBe(readsBefore + 1);
    });
    it("returns an atomic complete approval receipt and clears an omitted old note", async () => {
      const row = await makeReview("Old note must not become the reviewed decision"),
        a = await post(row.id, { expectedVersion: 0, decision: "APPROVED" });
      expect(a.status).toBe(200);
      expect(a.body.data).toMatchObject({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        status: "APPROVED",
        version: 1,
        moderationNote: null,
        moderatedAt: expect.any(String),
      });
      expect(a.body.data).not.toHaveProperty("customer");
      expect(a.body.data).not.toHaveProperty("customerId");
      expect(
        await prisma.notification.count({
          where: { resourceId: row.id, type: "REVIEW" },
        }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityType: "REVIEW", entityId: row.id, action: "STATUS_CHANGE" },
        }),
      ).toBe(1);
      const published = await get(
        "/public/support/reviews?targetType=BUSINESS&limit=50",
        customer,
      );
      expect(published.status).toBe(200);
      const visible = published.body.data.items.find(
        (r: { id: string }) => r.id === row.id,
      );
      expect(visible).toBeDefined();
      for (const field of [
        "moderationNote",
        "customer",
        "customerId",
        "moderatedByUserId",
        "version",
      ])
        expect(visible).not.toHaveProperty(field);
    });
    it("serializes competing decisions through CAS with one mutation audit and notification", async () => {
      const row = await makeReview(),
        decisions = await Promise.all([
          post(row.id, { expectedVersion: 0, decision: "APPROVED" }),
          post(row.id, {
            expectedVersion: 0,
            decision: "REJECTED",
            note: "Exact competing customer-visible rejection reason",
          }),
        ]);
      expect(decisions.map((r) => r.status).sort()).toEqual([200, 409]);
      const saved = decisions.find((r) => r.status === 200)!.body.data;
      expect(saved.version).toBe(1);
      expect(
        await prisma.notification.count({
          where: { resourceId: row.id, type: "REVIEW" },
        }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityType: "REVIEW", entityId: row.id, action: "STATUS_CHANGE" },
        }),
      ).toBe(1);
      expect(
        (await post(row.id, { expectedVersion: 1, decision: "APPROVED" })).status,
      ).toBe(409);
    });
    it("requires rejection reason, exact version, role/MFA and CSRF without partial writes", async () => {
      const row = await makeReview();
      expect(
        (await post(row.id, { expectedVersion: 0, decision: "REJECTED" })).status,
      ).toBe(422);
      expect(
        (await post(row.id, { expectedVersion: 1, decision: "APPROVED" })).status,
      ).toBe(409);
      expect(
        (await post(row.id, { expectedVersion: 0, decision: "APPROVED" }, staff)).status,
      ).toBe(403);
      expect(
        (await post(row.id, { expectedVersion: 0, decision: "APPROVED" }, unverified))
          .status,
      ).toBe(403);
      const bad = { ...admin, headers: { ...admin.headers, "x-csrf-token": "bad" } };
      expect(
        (await post(row.id, { expectedVersion: 0, decision: "APPROVED" }, bad)).status,
      ).toBe(403);
      expect(
        await prisma.auditLog.count({
          where: { entityType: "REVIEW", entityId: row.id, action: "STATUS_CHANGE" },
        }),
      ).toBe(0);
      const note = "Exact final customer-visible rejection reason",
        a = await post(row.id, { expectedVersion: 0, decision: "REJECTED", note });
      expect(a.status).toBe(200);
      expect(a.body.data).toMatchObject({
        id: row.id,
        status: "REJECTED",
        version: 1,
        moderationNote: note,
      });
    });
  },
);
