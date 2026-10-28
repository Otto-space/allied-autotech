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
  "managed job detail read contracts",
  () => {
    const evidence = process.env.WORKFORCE_JOB_DETAIL_READ_EVIDENCE!;
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
    async function get(
      index: number,
      suffix: string,
      query: Record<string, string | number> = {},
    ) {
      const result = await request(app)
        .get(`/api/v1/staff/workforce/jobs/${suffix}`)
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
      for (const index of [0, 5, 6, 7, 10]) {
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
    it("returns exact scoped branch and technician references without administrative fields", async () => {
      const response = await get(6, fixtures.ownIds[0]!);
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toContain("no-store");
      const job = workforceResponseSchema("job").parse(
        response.body.data,
      ) as typeof response.body.data;
      expect(job.access.userId).toBe(users[6]!.userId);
      expect(job.branch.id).toBe(fixtures.branchId);
      expect(job.branch.name).toBe(
        (await prisma.branch.findUniqueOrThrow({ where: { id: fixtures.branchId } }))
          .name,
      );
      const staff = await prisma.staffProfile.findUniqueOrThrow({
        where: { userId: users[6]!.userId },
        select: { id: true, firstName: true, lastName: true },
      });
      expect(job.assignedStaff).toEqual(staff);
      expect(job.assignedStaffId).toBe(staff.id);
      expect(Object.keys(job.branch).sort()).toEqual(["id", "name"]);
      for (const field of [
        "customerId",
        "quotedPriceKobo",
        "staffNotes",
        "passwordHash",
        "email",
      ])
        expect(job).not.toHaveProperty(field);
    });
    it("denies foreign, other-assignee, revoked and nontechnical detail or options access", async () => {
      expect((await get(6, fixtures.otherId)).status).toBe(404);
      expect((await get(6, fixtures.foreignId)).status).toBe(404);
      expect((await get(5, fixtures.foreignId)).status).toBe(404);
      for (const index of [0, 7, 10])
        expect((await get(index, fixtures.ownIds[0]!)).status).toBe(403);
      expect((await get(6, `${fixtures.ownIds[0]}/assignees`, { limit: 1 })).status).toBe(
        403,
      );
      expect((await get(5, `${fixtures.foreignId}/assignees`, { limit: 1 })).status).toBe(
        404,
      );
    });
    it("pages every existing eligible candidate and preserves the unparameterized response", async () => {
      const path = `${fixtures.ownIds[0]}/assignees`,
        legacy = await get(5, path);
      expect(legacy.status).toBe(200);
      expect(Object.keys(legacy.body.data)).toEqual(["items"]);
      expect(legacy.body.data.items.length).toBeGreaterThanOrEqual(2);
      const found: string[] = [];
      let cursor: string | undefined;
      do {
        const response = await get(5, path, { limit: 1, ...(cursor ? { cursor } : {}) });
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toContain("no-store");
        expect(
          workforceResponseSchema("jobAssignees").safeParse(response.body.data).success,
        ).toBe(true);
        expect(response.body.data.access.userId).toBe(users[5]!.userId);
        expect(response.body.data.jobId).toBe(fixtures.ownIds[0]);
        expect(response.body.data.branchId).toBe(fixtures.branchId);
        expect(response.body.data.jobVersion).toBe(
          (await prisma.booking.findUniqueOrThrow({ where: { id: fixtures.ownIds[0] } }))
            .version,
        );
        expect(response.body.data.items).toHaveLength(1);
        found.push(response.body.data.items[0].id);
        cursor = response.body.data.nextCursor;
        expect(found.length).toBeLessThanOrEqual(legacy.body.data.items.length);
      } while (cursor);
      expect(found).toEqual(
        legacy.body.data.items.map((item: { id: string }) => item.id).sort(),
      );
      expect(new Set(found).size).toBe(found.length);
      const target = legacy.body.data.items[0];
      const search = await get(5, path, {
        limit: 25,
        q: `${target.firstName} ${target.lastName}`.toUpperCase(),
      });
      expect(search.status).toBe(200);
      expect(search.body.data.items.map((item: { id: string }) => item.id)).toContain(
        target.id,
      );
      for (const q of ["%", "_", "no-such-candidate-q105"]) {
        const response = await get(5, path, { q, limit: 25 });
        expect(response.status).toBe(200);
        expect(response.body.data.items).toEqual(
          legacy.body.data.items.filter((item: { firstName: string; lastName: string }) =>
            `${item.firstName} ${item.lastName}`.toLowerCase().includes(q),
          ),
        );
      }
    });
    it("rejects branch overrides, malformed cursors, controls and unbounded searches", async () => {
      for (const query of [
        { branchId: fixtures.branchId },
        { cursor: "bad" },
        { limit: 51 },
        { limit: 0 },
        { q: "x".repeat(121) },
        { q: "a\u0000b" },
      ])
        expect((await get(5, `${fixtures.ownIds[0]}/assignees`, query)).status).toBe(422);
      expect(
        (await get(6, fixtures.ownIds[0]!, { branchId: fixtures.branchId })).status,
      ).toBe(422);
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
