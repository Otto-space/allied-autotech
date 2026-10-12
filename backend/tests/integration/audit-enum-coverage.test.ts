import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { AuditAction, AuditEntityType } from "../../src/generated/prisma/enums.js";
import { auditPageResponseSchema } from "../../src/modules/audit/audit-response.schemas.js";
import { operationsAccount } from "../helpers/operations-paging.js";

const app = createApp({ checkReadiness: async () => undefined });
const endpoint = "/api/v1/admin/audit";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Complete audit event contract",
  () => {
    let admin: Awaited<ReturnType<typeof operationsAccount>>;
    const reference = randomUUID();
    beforeAll(async () => {
      admin = await operationsAccount();
      const common = {
        userId: admin.user.id,
        entityId: reference,
        requestId: "synthetic-audit-enum",
        ipAddress: "127.0.0.2",
        userAgent: "PRIVATE-AUDIT-USER-AGENT",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        newValues: {
          label: "Synthetic audit",
          nested: { value: false, list: [0, null, ""] },
        },
      };
      await prisma.auditLog.createMany({
        data: [
          ...Object.values(AuditAction).map((action) => ({
            ...common,
            action,
            entityType: "USER" as const,
          })),
          ...Object.values(AuditEntityType).map((entityType) => ({
            ...common,
            action: "CREATE" as const,
            entityType,
          })),
        ],
      });
    });
    afterAll(() => prisma.$disconnect());
    const read = (query: Record<string, string | number> = {}, account = admin) =>
      request(app)
        .get(endpoint)
        .set(account.headers)
        .query({ entityId: reference, ...query });
    it("filters every database audit action, including failed logins", async () => {
      for (const action of Object.values(AuditAction)) {
        const response = await read({ action, limit: 100 });
        expect(response.status, action).toBe(200);
        const data = auditPageResponseSchema.parse(response.body.data);
        expect(data.items.length).toBeGreaterThan(0);
        expect(data.items.every((item) => item.action === action)).toBe(true);
      }
    });
    it("filters every database entity type, including booking slots and service categories", async () => {
      for (const entityType of Object.values(AuditEntityType)) {
        const response = await read({ entityType, limit: 100 });
        expect(response.status, entityType).toBe(200);
        const data = auditPageResponseSchema.parse(response.body.data);
        expect(data.items.length).toBeGreaterThan(0);
        expect(data.items.every((item) => item.entityType === entityType)).toBe(true);
      }
    });
    it("pages tied timestamps once, preserves nested values and excludes private actor/request fields", async () => {
      const expected = await prisma.auditLog.findMany({
        where: { entityId: reference },
        select: { id: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const response = await read({ limit: 7, ...(cursor ? { cursor } : {}) });
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("private, no-store");
        const data = auditPageResponseSchema.parse(response.body.data);
        seen.push(...data.items.map((item) => item.id));
        cursor = data.nextCursor;
        expect(JSON.stringify(response.body)).not.toMatch(
          /PRIVATE-AUDIT-USER-AGENT|ipAddress|userAgent|passwordHash|tokenHash|csrfTokenHash/,
        );
        for (const item of data.items) {
          expect(item.user).toEqual({ role: "ADMIN" });
          expect(item.oldValues).toBeNull();
          expect(item.newValues).toMatchObject({
            nested: { value: false, list: [0, null, ""] },
          });
        }
      } while (cursor && seen.length <= expected.length);
      expect(seen).toEqual(expected.map((item) => item.id));
      expect(cursor).toBeUndefined();
    });
    it("allows Super Admin and audits successful reads without granting other roles or unverified sessions access", async () => {
      const owner = await operationsAccount("SUPER_ADMIN");
      const before = await prisma.auditLog.count({
        where: {
          userId: owner.user.id,
          action: "READ",
          newValues: { path: ["resource"], equals: "AUDIT_LOG" },
        },
      });
      expect((await read({ action: "LOGIN_FAILED" }, owner)).status).toBe(200);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: owner.user.id,
            action: "READ",
            newValues: { path: ["resource"], equals: "AUDIT_LOG" },
          },
        }),
      ).toBe(before + 1);
      for (const role of ["CUSTOMER", "STAFF"] as const)
        expect((await read({}, await operationsAccount(role))).status).toBe(403);
      expect((await read({}, await operationsAccount("ADMIN", false))).status).toBe(403);
      expect(await request(app).get(endpoint)).toHaveProperty("status", 401);
    });
    it("rejects unknown enum values and out-of-range queries without recording successful reads", async () => {
      const before = await prisma.auditLog.count({
        where: { userId: admin.user.id, action: "READ" },
      });
      for (const query of [
        { action: "INVENTED" },
        { entityType: "INVENTED" },
        { limit: 101 },
        { branchId: randomUUID() },
        { from: "2026-01-01T00:00:00Z", to: "2026-05-01T00:00:00Z" },
      ])
        expect((await read(query)).status).toBe("from" in query ? 400 : 422);
      expect(
        await prisma.auditLog.count({ where: { userId: admin.user.id, action: "READ" } }),
      ).toBe(before);
    });
  },
);
