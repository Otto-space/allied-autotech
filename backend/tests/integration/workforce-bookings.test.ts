import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";

const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "managed bookings discovery contracts",
  () => {
    const evidence = process.env.WORKFORCE_BOOKINGS_READ_EVIDENCE!;
    const sessions: string[] = [];
    const identities: Record<number, Record<string, string>> = {};
    let guarded = false,
      beforeHash = "",
      auditBefore = 0,
      reads = 0;
    let fixtures: {
      ownIds: string[];
      otherId: string;
      foreignId: string;
      branchId: string;
    };
    let users: { userId: string }[];
    let counts: number[] = [];
    const rows = () =>
      Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
        prisma.booking.findMany({ orderBy: { id: "asc" } }),
        prisma.workOrder.findMany({ orderBy: { id: "asc" } }),
        prisma.service.findMany({ orderBy: { id: "asc" } }),
        prisma.customerVehicle.findMany({ orderBy: { id: "asc" } }),
        prisma.order.findMany({ orderBy: { id: "asc" } }),
        prisma.payment.findMany({ orderBy: { id: "asc" } }),
        prisma.refund.findMany({ orderBy: { id: "asc" } }),
        prisma.invoice.findMany({ orderBy: { id: "asc" } }),
        prisma.businessPolicyVersion.findMany({ orderBy: { id: "asc" } }),
      ]);
    const digest = (value: unknown) =>
      createHash("sha256")
        .update(
          JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
        )
        .digest("hex");
    async function get(index: number, query: Record<string, string | number> = {}) {
      const result = await request(app)
        .get("/api/v1/staff/workforce/bookings")
        .query(query)
        .set(identities[index]!);
      if (result.status === 200) reads++;
      return result;
    }
    beforeAll(async () => {
      expect(env.NODE_ENV).toBe("test");
      expect(
        await prisma.$queryRaw`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`,
      ).toEqual([
        {
          database: "allied_work_staff_workforce_20261019_test",
          host: "127.0.0.1",
          port: 55480,
        },
      ]);
      expect(
        await prisma.$queryRaw`SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS elevated, EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_database, EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND (c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) OR has_table_privilege(current_user,c.oid,'TRUNCATE'))) AS unsafe_tables FROM pg_roles WHERE rolname=current_user`,
      ).toEqual([{ elevated: false, owns_database: false, unsafe_tables: false }]);
      if (existsSync(evidence))
        throw Error("Read evidence exists; inspect it before repeating session writes");
      fixtures = JSON.parse(readFileSync(process.env.WORKFORCE_JOBS_FIXTURES!, "utf8"));
      users = JSON.parse(
        readFileSync(process.env.WORKFORCE_NOTIFICATIONS_FIXTURES!, "utf8"),
      ).users;
      const before = await rows();
      beforeHash = digest(before);
      counts = before.map((table) => table.length);
      auditBefore = await prisma.auditLog.count();
      guarded = true;
      for (const index of [0, 1, 5, 6, 7, 9, 10]) {
        const token = randomUUID(),
          expiry = new Date(Date.now() + 3600000);
        const session = await prisma.session.create({
          data: {
            userId: users[index]!.userId,
            tokenHash: hashToken("session", token),
            expiresAt: expiry,
            idleExpiresAt: expiry,
            mfaRequired: true,
            mfaVerifiedAt: new Date(),
            createdAt: new Date(Date.now() - 1000),
          },
        });
        sessions.push(session.id);
        identities[index] = { Cookie: `${sessionCookieName}=${token}` };
      }
    });
    it("returns scoped customer, vehicle and branch projections for both eligible responsibilities", async () => {
      for (const index of [0, 1]) {
        const response = await get(index);
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toContain("no-store");
        expect(
          workforceResponseSchema("bookings").safeParse(response.body.data).success,
        ).toBe(true);
        const data = response.body.data;
        expect(data.access.userId).toBe(users[index]!.userId);
        expect(data.items.length).toBeGreaterThan(0);
        const branches = data.access.assignments
          .filter((a: { template: string }) =>
            ["OPERATIONS", "CUSTOMER_SERVICE"].includes(a.template),
          )
          .map((a: { branchId: string }) => a.branchId);
        for (const item of data.items) {
          expect(branches).toContain(item.branchId);
          expect(item.branch.id).toBe(item.branchId);
          expect(Object.keys(item).sort()).toEqual(
            [
              "branch",
              "branchId",
              "customer",
              "id",
              "scheduledAt",
              "service",
              "status",
              "vehicle",
              "version",
            ].sort(),
          );
          expect(Object.keys(item.customer).sort()).toEqual([
            "firstName",
            "lastName",
            "phone",
          ]);
          expect(Object.keys(item.branch).sort()).toEqual(["id", "name"]);
          expect(Object.keys(item.service)).toEqual(["name"]);
          if (item.vehicle)
            expect(Object.keys(item.vehicle).sort()).toEqual([
              "make",
              "model",
              "registrationNumber",
              "year",
            ]);
          const actual = await prisma.booking.findUniqueOrThrow({
            where: { id: item.id },
            select: {
              customer: { select: { firstName: true, lastName: true, phone: true } },
              branch: { select: { id: true, name: true } },
              vehicle: {
                select: { make: true, model: true, year: true, registrationNumber: true },
              },
            },
          });
          expect({
            customer: item.customer,
            branch: item.branch,
            vehicle: item.vehicle,
          }).toEqual(actual);
        }
      }
    });
    it("pages the full branch scope and combines literal multi-term search with booking status", async () => {
      const first = await get(0, { limit: 50 });
      expect(first.status).toBe(200);
      const branchIds = first.body.data.access.assignments
        .filter((a: { template: string }) =>
          ["OPERATIONS", "CUSTOMER_SERVICE"].includes(a.template),
        )
        .map((a: { branchId: string }) => a.branchId);
      const expected = await prisma.booking.findMany({
        where: { branchId: { in: branchIds } },
        orderBy: { id: "asc" },
        include: { customer: true, service: true, vehicle: true },
      });
      expect(expected.length).toBeGreaterThan(7);
      const collected: string[] = [];
      let cursor: string | undefined;
      do {
        const response = await get(0, { limit: 7, ...(cursor ? { cursor } : {}) });
        expect(response.status).toBe(200);
        collected.push(
          ...response.body.data.items.map((item: { id: string }) => item.id),
        );
        cursor = response.body.data.nextCursor;
        expect(collected.length).toBeLessThanOrEqual(expected.length);
      } while (cursor);
      expect(collected).toEqual(expected.map((item) => item.id));
      expect(collected).not.toContain(fixtures.foreignId);
      const target = expected[0]!;
      const terms = [target.customer.firstName, target.customer.lastName];
      for (const q of [
        terms.join(" ").toUpperCase(),
        "%",
        "_",
        "\\",
        "no-such-booking-q106",
      ]) {
        const response = await get(0, { q, limit: 50, status: target.status });
        expect(response.status).toBe(200);
        const matches = expected.filter(
          (item) =>
            item.status === target.status &&
            q
              .toLowerCase()
              .split(/\s+/)
              .every((term) =>
                [
                  item.service.name,
                  item.customer.firstName,
                  item.customer.lastName,
                  item.customer.phone,
                  item.vehicle?.make,
                  item.vehicle?.model,
                  item.vehicle?.registrationNumber,
                ].some((value) => value?.toLowerCase().includes(term)),
              ),
        );
        expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual(
          matches.slice(0, 50).map((item) => item.id),
        );
      }
      const vehicleTarget = expected.find((item) => item.vehicle?.registrationNumber);
      expect(vehicleTarget).toBeDefined();
      const vehicle = await get(0, {
        q: vehicleTarget!.vehicle!.registrationNumber!,
        limit: 50,
      });
      expect(vehicle.status).toBe(200);
      expect(vehicle.body.data.items.map((item: { id: string }) => item.id)).toContain(
        vehicleTarget!.id,
      );
    });
    it("denies technicians, revoked or suspended staff, customers and anonymous callers", async () => {
      for (const index of [5, 6, 7, 10]) expect((await get(index)).status).toBe(403);
      expect((await get(9)).status).toBe(401);
      expect((await request(app).get("/api/v1/staff/workforce/bookings")).status).toBe(
        401,
      );
    });
    it("rejects branch overrides, unknown states, duplicate filters and invalid bounds", async () => {
      for (const query of [
        { branchId: fixtures.branchId },
        { status: "DRAFT" },
        { status: "toString" },
        { cursor: "bad" },
        { limit: 51 },
        { limit: 0 },
        { q: "x".repeat(121) },
        { q: "a\u0000b" },
      ])
        expect((await get(0, query)).status).toBe(422);
      const repeated = await request(app)
        .get("/api/v1/staff/workforce/bookings?q=a&q=b")
        .set(identities[0]!);
      expect(repeated.status).toBe(422);
    });
    afterAll(async () => {
      try {
        if (guarded) {
          await prisma.session.deleteMany({ where: { id: { in: sessions } } });
          const originalRowsUnchanged = digest(await rows()) === beforeHash;
          const auditDelta = (await prisma.auditLog.count()) - auditBefore;
          const remaining = await prisma.session.count({
            where: { id: { in: sessions } },
          });
          writeFileSync(
            evidence,
            JSON.stringify({
              originalRowsUnchanged,
              originalCounts: counts,
              successfulReads: reads,
              auditDelta,
              temporarySessionsRemaining: remaining,
            }),
          );
          expect(originalRowsUnchanged).toBe(true);
          expect(auditDelta).toBe(reads);
          expect(remaining).toBe(0);
        }
      } finally {
        await prisma.$disconnect();
      }
    });
  },
);
