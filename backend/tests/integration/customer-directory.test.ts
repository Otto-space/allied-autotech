import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { testOwner } from "../helpers/owner.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "admin customer directory",
  () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const prefix = `Directory${randomUUID().replaceAll("-", "")}`;
    const cookies = new Map<UserRole, string>();
    const ids: string[] = [];
    let admin: string;
    beforeAll(async () => {
      for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
        const user =
          role === "SUPER_ADMIN"
            ? await testOwner("unusable-test-password")
            : await prisma.user.create({
                data: {
                  email: `${randomUUID()}@example.test`,
                  passwordHash: "secret-not-projected",
                  role,
                },
              });
        const token = generateOpaqueToken();
        const expires = new Date(Date.now() + 3_600_000);
        await prisma.session.create({
          data: {
            userId: user.id,
            createdAt: new Date(Date.now() - 1000),
            tokenHash: hashToken("session", token),
            expiresAt: expires,
            idleExpiresAt: expires,
            mfaRequired: role !== "CUSTOMER",
            mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
          },
        });
        cookies.set(role, `${sessionCookieName}=${token}`);
      }
      admin = cookies.get("ADMIN")!;
      for (let n = 0; n < 7; n++) {
        const user = await prisma.user.create({
          data: {
            email: `${prefix.toLowerCase()}-${n}@example.test`,
            passwordHash: "secret-not-projected",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            emailVerifiedAt: n % 2 ? null : new Date(),
            status: n === 6 ? "DEACTIVATED" : "ACTIVE",
            profile: {
              create: {
                firstName: prefix,
                lastName: `Person ${n}`,
                phone: `+234 (800) 000-000${n}`,
                address: "Test address",
              },
            },
          },
          include: { profile: true },
        });
        ids.push(user.profile!.id);
      }
    }, 60_000);
    afterAll(async () => prisma.$disconnect());
    const get = (path = "", cookie = admin) =>
      request(app).get(`/api/v1/admin/customers${path}`).set("Cookie", cookie);
    it.each(["CUSTOMER", "STAFF"] as const)(
      "denies %s on directory, detail and every related endpoint",
      async (role) => {
        for (const suffix of [
          "",
          `/${ids[0]}`,
          ...[
            "vehicles",
            "bookings",
            "quotations",
            "orders",
            "payments",
            "enquiries",
            "complaints",
          ].map((kind) => `/${ids[0]}/${kind}`),
        ]) {
          const response = await get(suffix, cookies.get(role)!);
          expect(response.status).toBe(403);
          expect(response.body.error.code).toBe("FORBIDDEN");
        }
      },
    );
    it("denies anonymous requests", async () => {
      expect((await request(app).get("/api/v1/admin/customers")).status).toBe(401);
    });
    it.each(["ADMIN", "SUPER_ADMIN"] as const)(
      "allows %s and excludes secrets",
      async (role) => {
        const response = await get(`?search=${prefix}`, cookies.get(role)!);
        expect(response.status).toBe(200);
        expect(response.body.data.items).toHaveLength(7);
        expect(response.headers["cache-control"]).toBe("private, no-store");
        expect(Object.keys(response.body.data.items[0]).sort()).toEqual(
          [
            "id",
            "firstName",
            "lastName",
            "email",
            "phone",
            "status",
            "emailVerified",
            "phoneVerified",
            "createdAt",
          ].sort(),
        );
        expect(JSON.stringify(response.body)).not.toMatch(
          /password|session|secret|tokenHash/,
        );
      },
    );
    it("normalizes permitted searches and treats SQL wildcard characters literally", async () => {
      expect(
        (
          await get(
            `?field=name&search=%20%20${prefix.toUpperCase()}%20%20Person%20%200%20`,
          )
        ).body.data.items,
      ).toHaveLength(1);
      expect(
        (await get(`?field=email&search=${prefix.toUpperCase()}-1`)).body.data.items,
      ).toHaveLength(1);
      expect(
        (
          await get(`?field=phone&search=${encodeURIComponent("+234 (800) 000-0002")}`)
        ).body.data.items.map((r: { id: string }) => r.id),
      ).toContain(ids[2]);
      expect((await get(`?field=id&search=${ids[3]}`)).body.data.items[0].id).toBe(
        ids[3],
      );
      expect((await get("?search=%25%25")).body.data.items).toEqual([]);
    });
    it("filters status and verification", async () => {
      const result = await get(`?search=${prefix}&status=ACTIVE&verified=true`);
      expect(result.body.data.items).toHaveLength(3);
    });
    it.each(["newest", "oldest"])(
      "traverses tied registration dates without omissions or duplicates (%s)",
      async (sort) => {
        let cursor: string | undefined;
        const found: string[] = [];
        do {
          const result = await get(
            `?search=${prefix}&sort=${sort}&limit=2${cursor ? `&cursor=${cursor}` : ""}`,
          );
          expect(result.status).toBe(200);
          found.push(...result.body.data.items.map((row: { id: string }) => row.id));
          cursor = result.body.data.nextCursor;
        } while (cursor);
        expect(found.sort()).toEqual([...ids].sort());
      },
    );
    it.each([
      "limit=0",
      "limit=51",
      "cursor=bad",
      "search=a",
      "search=" + "a".repeat(121),
      "field=id&search=bad",
      "sort=email",
      "branchId=" + randomUUID(),
      "field=phone&search=12",
    ])("rejects invalid query %s", async (query) => {
      expect((await get(`?${query}`)).status).toBe(422);
    });
    it("binds cursors to filters", async () => {
      const first = await get(`?search=${prefix}&limit=1`);
      expect(
        (await get(`?search=other&cursor=${first.body.data.nextCursor}`)).status,
      ).toBe(422);
    });
    it("supports empty and no-result queries and unavailable customers", async () => {
      expect((await get("?search=")).status).toBe(200);
      expect((await get(`?search=Missing${randomUUID()}`)).body.data.items).toEqual([]);
      expect((await get(`/${randomUUID()}`)).status).toBe(404);
      expect((await get("/invalid")).status).toBe(422);
    });
    it("bounds independent collections and rejects cross-customer cursors", async () => {
      for (let n = 0; n < 4; n++)
        await prisma.customerVehicle.create({
          data: { customerId: ids[0]!, make: "Test", model: `Vehicle ${n}`, year: 2020 },
        });
      const first = await get(`/${ids[0]}/vehicles?limit=2`);
      expect(first.body.data.items).toHaveLength(2);
      expect(first.body.data.nextCursor).toBeTruthy();
      const next = await get(
        `/${ids[0]}/vehicles?limit=2&cursor=${first.body.data.nextCursor}`,
      );
      expect(next.body.data.items).toHaveLength(2);
      expect(next.body.data.nextCursor).toBeUndefined();
      expect(
        (await get(`/${ids[1]}/vehicles?cursor=${first.body.data.nextCursor}`)).status,
      ).toBe(422);
      for (const kind of [
        "bookings",
        "quotations",
        "orders",
        "payments",
        "enquiries",
        "complaints",
      ]) {
        const result = await get(`/${ids[0]}/${kind}?limit=2`);
        expect(result.status).toBe(200);
        expect(result.body.data.items).toEqual([]);
      }
      expect((await get(`/${ids[0]}`)).body.data.address).toBe("Test address");
    });
    it("audits reads without search text or contact values", async () => {
      const logs = await prisma.auditLog.findMany({
        where: { entityType: "CUSTOMER_PROFILE", action: "READ", entityId: ids[0]! },
      });
      expect(logs.length).toBeGreaterThan(0);
      expect(JSON.stringify(logs.map((r) => r.newValues))).not.toContain(prefix);
    });
  },
);
