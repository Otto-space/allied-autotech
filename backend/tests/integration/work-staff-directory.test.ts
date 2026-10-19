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
  "staff directory discovery",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let admin: Actor,
      owner: Actor,
      staff: Actor,
      customer: Actor,
      branchId: string,
      prefix: string,
      beforeHash: string;
    const sessions: string[] = [],
      originalIds: string[] = [],
      createdIds: string[] = [];
    const hash = (v: unknown) =>
      createHash("sha256").update(JSON.stringify(v)).digest("hex");
    async function protectedRows() {
      return hash(
        await Promise.all([
          prisma.user.findMany({
            where: { id: { in: originalIds } },
            orderBy: { id: "asc" },
          }),
          prisma.staffProfile.findMany({
            where: { userId: { in: originalIds } },
            orderBy: { id: "asc" },
          }),
          prisma.userCapability.findMany({
            where: { userId: { in: originalIds } },
            orderBy: { id: "asc" },
          }),
        ]),
      );
    }
    async function auth(id: string, role: string) {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expires = new Date(Date.now() + 3600000);
      const row = await prisma.session.create({
        data: {
          userId: id,
          createdAt: new Date(Date.now() - 1000),
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          expiresAt: expires,
          idleExpiresAt: expires,
          mfaRequired: role !== "CUSTOMER",
          mfaVerifiedAt: role !== "CUSTOMER" ? new Date() : null,
        },
      });
      sessions.push(row.id);
      return {
        id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
        },
      };
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
      originalIds.push(
        ...(await prisma.user.findMany({ select: { id: true } })).map((v) => v.id),
      );
      beforeHash = await protectedRows();
      branchId = (
        await prisma.branch.findFirstOrThrow({
          where: { isActive: true },
          select: { id: true },
        })
      ).id;
      prefix = `directory-${randomUUID()}`;
      for (let n = 0; n < 28; n++) {
        const row = await prisma.user.create({
          data: {
            email: `${prefix}-${n}@example.test`,
            passwordHash: "unusable-isolated-test-only",
            role: n === 1 ? "ADMIN" : "STAFF",
            status: n === 2 ? "SUSPENDED" : "ACTIVE",
            emailVerifiedAt: n === 3 ? null : new Date(),
            staffProfile: {
              create: {
                firstName: n === 0 ? "Ada" : n === 4 ? "100%_literal" : "Member",
                lastName: n === 0 ? `Okoro-${prefix}` : `${prefix}-${n}`,
                branchId: n === 3 ? null : branchId,
                jobTitle: "Synthetic directory fixture",
              },
            },
          },
        });
        createdIds.push(row.id);
      }
      admin = await auth(createdIds[1]!, "ADMIN");
      staff = await auth(createdIds[0]!, "STAFF");
      owner = await auth(base.owner, "SUPER_ADMIN");
      customer = await auth(base.customer, "CUSTOMER");
      writeFileSync(
        process.env.WORK_STAFF_DIRECTORY_FIXTURES!,
        JSON.stringify(
          {
            admin: admin.id,
            owner: owner.id,
            staff: staff.id,
            customer: customer.id,
            branchId,
            prefix,
            createdIds,
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
    it("searches literal email/full name with combined filters and stable 25+3 cursor pages", async () => {
      const first = await request(app)
        .get(root)
        .query({ q: prefix, limit: 25 })
        .set(admin.headers);
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(first.body.data.items).toHaveLength(25);
      expect(first.body.data.nextCursor).toBe(first.body.data.items[24].id);
      const next = await request(app)
        .get(root)
        .query({ q: prefix, limit: 25, cursor: first.body.data.nextCursor })
        .set(admin.headers);
      expect(next.status).toBe(200);
      expect(next.body.data.items).toHaveLength(3);
      expect(next.body.data.nextCursor).toBeUndefined();
      expect(
        new Set([...first.body.data.items, ...next.body.data.items].map((v) => v.id))
          .size,
      ).toBe(28);
      const full = await request(app)
        .get(root)
        .query({
          q: `ADA OKORO-${prefix.toUpperCase()}`,
          role: "STAFF",
          status: "ACTIVE",
          branchId,
        })
        .set(admin.headers);
      expect(full.status).toBe(200);
      expect(full.body.data.items.map((v: { id: string }) => v.id)).toEqual([staff.id]);
      const literal = await request(app)
        .get(root)
        .query({ q: "%_", limit: 100 })
        .set(admin.headers);
      expect(literal.status).toBe(200);
      expect(literal.body.data.items.map((v: { id: string }) => v.id)).toContain(
        createdIds[4],
      );
      expect(
        literal.body.data.items.every((v: { staffProfile: { firstName: string } }) =>
          v.staffProfile.firstName.includes("%_"),
        ),
      ).toBe(true);
      const zero = await request(app)
        .get(root)
        .query({ q: prefix, status: "DEACTIVATED" })
        .set(admin.headers);
      expect(zero.body.data.items).toEqual([]);
    });
    it("preserves administrator scope, minimal read audit and safe fields without changing accounts", async () => {
      const before = await prisma.auditLog.count({
        where: { userId: owner.id, action: "READ", entityType: "STAFF_PROFILE" },
      });
      const r = await request(app).get(root).query({ q: prefix }).set(owner.headers);
      expect(r.status).toBe(200);
      expect(
        await prisma.auditLog.count({
          where: { userId: owner.id, action: "READ", entityType: "STAFF_PROFILE" },
        }),
      ).toBe(before + 1);
      for (const v of r.body.data.items) {
        expect(Object.keys(v).sort()).toEqual([
          "createdAt",
          "email",
          "emailVerifiedAt",
          "id",
          "role",
          "staffProfile",
          "status",
          "updatedAt",
        ]);
        expect(v).not.toHaveProperty("passwordHash");
      }
      for (const a of [staff, customer])
        expect((await request(app).get(root).set(a.headers)).status).toBe(403);
      expect((await request(app).get(root)).status).toBe(401);
      for (const q of [
        { q: "a" },
        { q: "x".repeat(101) },
        { q: "ab\u0000" },
        { role: "CUSTOMER" },
        { branchId: "bad" },
        { limit: 101 },
        { unknown: "x" },
      ])
        expect((await request(app).get(root).query(q).set(admin.headers)).status).toBe(
          422,
        );
      expect(await protectedRows()).toBe(beforeHash);
    });
  },
);
