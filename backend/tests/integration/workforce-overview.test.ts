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
  "authoritative workforce overview",
  () => {
    const evidence = process.env.WORKFORCE_OVERVIEW_EVIDENCE!;
    const sessions: string[] = [];
    let users: { userId: string }[], before: string;
    let headers: Record<string, string>[];
    let weak: Record<string, string>;
    let guarded = false;
    let successfulReads = 0;
    let auditBefore = 0;
    const rows = () =>
      Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
        prisma.booking.findMany({ orderBy: { id: "asc" } }),
        prisma.order.findMany({ orderBy: { id: "asc" } }),
        prisma.enquiry.findMany({ orderBy: { id: "asc" } }),
        prisma.complaint.findMany({ orderBy: { id: "asc" } }),
        prisma.businessPolicyVersion.findMany({ orderBy: { id: "asc" } }),
      ]);
    const digest = (value: unknown) =>
      createHash("sha256")
        .update(
          JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
        )
        .digest("hex");
    async function auth(userId: string, mfa = true) {
      const token = randomUUID(),
        expiry = new Date(Date.now() + 3600000);
      const row = await prisma.session.create({
        data: {
          userId,
          tokenHash: hashToken("session", token),
          expiresAt: expiry,
          idleExpiresAt: expiry,
          mfaRequired: true,
          mfaVerifiedAt: mfa ? new Date() : null,
          createdAt: new Date(Date.now() - 1000),
        },
      });
      sessions.push(row.id);
      return { Cookie: `${sessionCookieName}=${token}` };
    }
    const get = (identity: Record<string, string>, suffix = "") =>
      request(app).get(`/api/v1/staff/workforce/overview${suffix}`).set(identity);
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
          "Overview evidence exists; inspect completed reads before continuation.",
        );
      users = JSON.parse(
        readFileSync(process.env.WORKFORCE_NOTIFICATIONS_FIXTURES!, "utf8"),
      ).users;
      before = digest(await rows());
      auditBefore = await prisma.auditLog.count();
      writeFileSync(evidence, JSON.stringify({ phase: "started", before, auditBefore }));
      guarded = true;
      headers = [];
      for (const user of users) headers.push(await auth(user.userId));
      weak = await auth(users[0]!.userId, false);
    }, 30000);
    it("returns matching current identity, assignments and only scoped branch names", async () => {
      for (let index = 0; index < 9; index++) {
        const response = await get(headers[index]!);
        expect(response.status).toBe(200);
        successfulReads++;
        expect(response.headers["cache-control"]).toBe("private, no-store");
        expect(
          workforceResponseSchema("overview").safeParse(response.body.data).success,
        ).toBe(true);
        const data = response.body.data;
        expect(data.access.userId).toBe(users[index]!.userId);
        expect(data.access.managed).toBe(true);
        const assigned = [
          ...new Set(
            data.access.assignments.map(
              (assignment: { branchId: string }) => assignment.branchId,
            ),
          ),
        ].sort();
        expect(data.branches.map((branch: { id: string }) => branch.id).sort()).toEqual(
          assigned,
        );
        for (const branch of data.branches) {
          expect(Object.keys(branch).sort()).toEqual(["id", "name"]);
          const stored = await prisma.branch.findUniqueOrThrow({
            where: { id: branch.id },
            select: { name: true },
          });
          expect(branch.name).toBe(stored.name);
        }
        expect(data.access).not.toHaveProperty("email");
        expect(data.access).not.toHaveProperty("passwordHash");
        expect(data.counts).not.toHaveProperty("payments");
      }
    });
    it("accountant keeps finance authority without an invented payment counter", async () => {
      const response = await get(headers[4]!);
      expect(response.status).toBe(200);
      successfulReads++;
      expect(response.body.data.access.permissions).toEqual(["FINANCE_READ"]);
      expect(response.body.data.counts).toEqual({});
      expect(response.body.data.branches).toHaveLength(1);
    });
    it("revoked responsibilities produce an empty authoritative overview", async () => {
      const response = await get(headers[7]!);
      expect(response.status).toBe(200);
      successfulReads++;
      expect(response.body.data).toMatchObject({
        counts: {},
        branches: [],
        access: { assignments: [], permissions: [] },
      });
    });
    it("missing MFA, suspension, customer and non-enrolled staff remain denied", async () => {
      expect((await get(weak)).status).toBe(403);
      expect((await get(headers[9]!)).status).toBe(401);
      expect((await get(headers[10]!)).status).toBe(403);
      expect((await get(headers[11]!)).status).toBe(403);
    });
    it("rejects forged account and branch query parameters", async () => {
      expect((await get(headers[0]!, `?userId=${users[1]!.userId}`)).status).toBe(422);
      expect((await get(headers[0]!, `?branchId=${randomUUID()}`)).status).toBe(422);
    });
    afterAll(async () => {
      try {
        if (guarded) {
          await prisma.session.deleteMany({ where: { id: { in: sessions } } });
          const after = await rows(),
            unchanged = digest(after) === before,
            auditDelta = (await prisma.auditLog.count()) - auditBefore;
          writeFileSync(
            evidence,
            JSON.stringify({
              originalRowsUnchanged: unchanged,
              counts: after.map((table) => table.length),
              successfulReads,
              auditDelta,
              temporarySessionsRemaining: await prisma.session.count({
                where: { id: { in: sessions } },
              }),
            }),
          );
          expect(unchanged).toBe(true);
          expect(auditDelta).toBe(successfulReads);
        }
      } finally {
        await prisma.$disconnect();
      }
    });
  },
);
