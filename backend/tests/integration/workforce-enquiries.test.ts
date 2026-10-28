import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { issueCsrfToken } from "../../src/common/security/csrf-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "managed enquiry workspace",
  () => {
    const evidence = process.env.WORKFORCE_ENQUIRIES_EVIDENCE!;
    const fixturePath = process.env.WORKFORCE_ENQUIRIES_FIXTURES!;
    const sessions: string[] = [],
      owned: string[] = [];
    const identities: Record<number, Record<string, string>> = {};
    let guarded = false,
      beforeHash = "",
      auditBefore = 0,
      reads = 0,
      writes = 0;
    let counts: number[] = [],
      users: { userId: string }[],
      branchId: string,
      foreignBranch: string;
    let cashier: { id: string },
      supervisor: { id: string },
      originalLatest: string,
      internalId: string;
    const rows = () =>
      Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
        prisma.booking.findMany({ orderBy: { id: "asc" } }),
        prisma.workOrder.findMany({ orderBy: { id: "asc" } }),
        prisma.order.findMany({ orderBy: { id: "asc" } }),
        prisma.payment.findMany({ orderBy: { id: "asc" } }),
        prisma.refund.findMany({ orderBy: { id: "asc" } }),
        prisma.invoice.findMany({ orderBy: { id: "asc" } }),
        prisma.businessPolicyVersion.findMany({ orderBy: { id: "asc" } }),
        prisma.enquiry.findMany({
          where: { id: { notIn: owned } },
          orderBy: { id: "asc" },
        }),
        prisma.supportMessage.findMany({
          where: { OR: [{ enquiryId: null }, { enquiryId: { notIn: owned } }] },
          orderBy: { id: "asc" },
        }),
      ]);
    const digest = (value: unknown) =>
      createHash("sha256")
        .update(
          JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
        )
        .digest("hex");
    async function get(
      index: number,
      suffix = "",
      query: Record<string, string | number> = {},
    ) {
      const result = await request(app)
        .get("/api/v1/staff/workforce/enquiries" + suffix)
        .query(query)
        .set(identities[index]!);
      if (result.status === 200) {
        reads++;
        expect(result.headers["cache-control"]).toContain("no-store");
      }
      return result;
    }
    async function change(
      index: number,
      id: string,
      action: "replies" | "assignment",
      body: Record<string, unknown>,
      csrf = true,
    ) {
      const headers = { ...identities[index] };
      if (!csrf) delete headers["x-csrf-token"];
      const result = await request(app)
        [action === "replies" ? "post" : "patch"](
          `/api/v1/staff/workforce/enquiries/${id}/${action}`,
        )
        .set(headers)
        .send(body);
      if (result.status === 200) {
        writes++;
        expect(
          workforceResponseSchema(
            action === "replies" ? "reply" : "enquiryAssignment",
          ).safeParse(result.body.data).success,
        ).toBe(true);
      }
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

      const resumeEmptySetup =
        process.env.WORKFORCE_ENQUIRIES_RESUME_EMPTY_SETUP === "true";
      if (existsSync(evidence) || (existsSync(fixturePath) && !resumeEmptySetup))
        throw Error(
          "Enquiry evidence or fixtures exist; inspect before repeating writes",
        );
      if (resumeEmptySetup) {
        const retained = JSON.parse(readFileSync(fixturePath, "utf8"));
        expect(retained.setupComplete).toBe(false);
        owned.push(...retained.owned);
        expect(await prisma.enquiry.count({ where: { id: { in: owned } } })).toBe(0);
        expect(
          await prisma.supportMessage.count({ where: { enquiryId: { in: owned } } }),
        ).toBe(0);
        expect(digest(await rows())).toBe(retained.beforeHash);
      }
      users = JSON.parse(
        readFileSync(process.env.WORKFORCE_NOTIFICATIONS_FIXTURES!, "utf8"),
      ).users;
      const prior = JSON.parse(
        readFileSync(process.env.WORKFORCE_JOBS_FIXTURES!, "utf8"),
      );
      branchId = prior.branchId;
      foreignBranch = (
        await prisma.booking.findUniqueOrThrow({
          where: { id: prior.foreignId },
          select: { branchId: true },
        })
      ).branchId!;
      cashier = await prisma.staffProfile.findUniqueOrThrow({
        where: { userId: users[3]!.userId },
        select: { id: true },
      });
      supervisor = await prisma.staffProfile.findUniqueOrThrow({
        where: { userId: users[2]!.userId },
        select: { id: true },
      });
      const source = await prisma.enquiry.findFirstOrThrow({
        where: { type: { in: ["PRODUCT", "VEHICLE"] } },
      });
      const before = await rows();
      beforeHash = digest(before);
      counts = before.map((r) => r.length);
      auditBefore = await prisma.auditLog.count();
      guarded = true;
      // Dedicated synthetic records; retained historical fixtures are never mutated.
      if (!resumeEmptySetup) for (let i = 0; i < 34; i++) owned.push(randomUUID());
      writeFileSync(
        fixturePath,
        JSON.stringify({ owned, branchId, beforeHash, counts, setupComplete: false }),
      );
      await prisma.enquiry.createMany({
        data: owned.map((id, i) => ({
          id,
          branchId: i === 33 ? foreignBranch : branchId,
          assignedStaffId: i === 31 ? null : cashier.id,
          type: i === 30 ? "GENERAL" : source.type,
          productId: i === 30 ? null : source.productId,
          vehicleListingId: i === 30 ? null : source.vehicleListingId,
          subject: `Synthetic milestone107 enquiry ${i}${i === 0 ? " literal %_" : ""}`,
          message: "Synthetic customer-visible enquiry text.",
          name: "Synthetic Enquiry Customer",
          email: "enquiry107@example.test",
          status: i === 32 ? "CLOSED" : "OPEN",
          closedAt: i === 32 ? new Date() : null,
          resolvedAt: i === 32 ? new Date() : null,
        })),
      });
      const messageIds = Array.from({ length: 28 }, () => randomUUID());
      originalLatest = messageIds[26]!;
      internalId = messageIds[27]!;
      await prisma.supportMessage.createMany({
        data: messageIds.map((id, i) => ({
          id,
          enquiryId: owned[0]!,
          authorUserId: users[1]!.userId,
          authorType: i === 27 ? "STAFF" : "CUSTOMER",
          visibility: i === 27 ? "INTERNAL" : "CUSTOMER",
          body:
            i === 27
              ? "private-internal-q107"
              : "Synthetic visible-history-q107 message " + i,
          createdAt: new Date(Date.now() - 60000 + i * 1000),
        })),
      });
      writeFileSync(
        fixturePath,
        JSON.stringify({
          owned,
          branchId,
          foreignBranch,
          originalLatest,
          internalId,
          beforeHash,
          counts,
          setupComplete: true,
        }),
      );
      for (const index of [0, 1, 2, 3, 7, 9, 10]) {
        const token = randomUUID(),
          csrf = issueCsrfToken(),
          expiresAt = new Date(Date.now() + 3600000);
        const session = await prisma.session.create({
          data: {
            userId: users[index]!.userId,
            tokenHash: hashToken("session", token),
            csrfTokenHash: csrf.hash,
            expiresAt,
            idleExpiresAt: expiresAt,
            mfaRequired: true,
            mfaVerifiedAt: new Date(),
            createdAt: new Date(Date.now() - 1000),
          },
        });
        sessions.push(session.id);
        identities[index] = {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: "http://localhost:3000",
          "x-csrf-token": csrf.raw,
        };
      }
    });
    it("enforces branch, type, assignee and private projection across all eligible roles", async () => {
      for (const index of [1, 2, 3]) {
        const response = await get(index, "", { q: "milestone107", limit: 50 });
        expect(response.status).toBe(200);
        expect(
          workforceResponseSchema("enquiries").safeParse(response.body.data).success,
        ).toBe(true);
        const ids = response.body.data.items.map((r: { id: string }) => r.id);
        expect(ids).not.toContain(owned[33]);
        expect(ids.includes(owned[30])).toBe(index === 1);
        expect(ids.includes(owned[31])).toBe(index !== 3);
        for (const row of response.body.data.items) {
          expect(row.branchId).toBe(branchId);
          expect(row.branch.id).toBe(branchId);
          for (const field of [
            "name",
            "email",
            "phone",
            "customerId",
            "vehicleListingId",
            "productId",
          ])
            expect(row).not.toHaveProperty(field);
        }
      }
      expect((await get(3, "/" + owned[31])).status).toBe(404);
      expect((await get(2, "/" + owned[30])).status).toBe(404);
      for (const index of [1, 2, 3])
        expect((await get(index, "/" + owned[33])).status).toBe(404);
    });
    it("pages scoped discovery and searches literal text without matching internal messages", async () => {
      const all: string[] = [];
      let cursor: string | undefined;
      do {
        const response = await get(1, "", {
          q: "milestone107",
          limit: 7,
          ...(cursor ? { cursor } : {}),
        });
        expect(response.status).toBe(200);
        all.push(...response.body.data.items.map((r: { id: string }) => r.id));
        cursor = response.body.data.nextCursor;
        expect(all.length).toBeLessThanOrEqual(33);
      } while (cursor);
      expect(all).toEqual(owned.slice(0, 33).sort());
      for (const q of ["%_", "visible-history-q107", "milestone107 literal"]) {
        const response = await get(1, "", { q });
        expect(response.status).toBe(200);
        expect(response.body.data.items.map((r: { id: string }) => r.id)).toEqual([
          owned[0],
        ]);
      }
      expect((await get(1, "", { q: "private-internal-q107" })).body.data.items).toEqual(
        [],
      );
      expect(
        (
          await get(1, "", { q: "milestone107", type: "GENERAL", status: "OPEN" })
        ).body.data.items.map((r: { id: string }) => r.id),
      ).toEqual([owned[30]]);
    });
    it("pages only customer-visible history and rejects foreign or internal cursors", async () => {
      const first = await get(1, "/" + owned[0], { limit: 25 });
      expect(first.status).toBe(200);
      expect(workforceResponseSchema("enquiry").safeParse(first.body.data).success).toBe(
        true,
      );
      expect(first.body.data.latestMessageId).toBe(originalLatest);
      expect(first.body.data.messages.items).toHaveLength(25);
      for (const message of first.body.data.messages.items) {
        expect(message.visibility).toBe("CUSTOMER");
        expect(message).not.toHaveProperty("authorUserId");
      }
      const second = await get(1, "/" + owned[0], {
        limit: 25,
        cursor: first.body.data.messages.nextCursor,
      });
      expect(second.status).toBe(200);
      expect(second.body.data.messages.items).toHaveLength(2);
      expect((await get(1, "/" + owned[0], { cursor: internalId })).status).toBe(404);
      expect((await get(1, "/" + owned[1], { cursor: originalLatest })).status).toBe(404);
    });
    it("preserves legacy staff options and verifies searched paged eligibility", async () => {
      const legacy = await get(2, `/${owned[0]}/assignees`);
      expect(legacy.status).toBe(200);
      const ids: string[] = [];
      let cursor: string | undefined;
      do {
        const result = await get(2, `/${owned[0]}/assignees`, {
          limit: 1,
          ...(cursor ? { cursor } : {}),
        });
        expect(result.status).toBe(200);
        expect(result.body.data).toMatchObject({
          enquiryId: owned[0],
          enquiryVersion: 0,
          branchId,
        });
        ids.push(...result.body.data.items.map((r: { id: string }) => r.id));
        cursor = result.body.data.nextCursor;
        expect(ids.length).toBeLessThanOrEqual(legacy.body.data.items.length);
      } while (cursor);
      expect(ids).toEqual(legacy.body.data.items.map((r: { id: string }) => r.id));
      expect(ids).toContain(cashier.id);
      const name = legacy.body.data.items[0].firstName;
      expect(
        (await get(2, `/${owned[0]}/assignees`, { q: name, limit: 25 })).body.data.items
          .length,
      ).toBeGreaterThan(0);
      expect((await get(1, `/${owned[0]}/assignees`, { limit: 25 })).status).toBe(403);
    });
    it("records exact replies, rejects stale latest-message guards and preserves older caller compatibility", async () => {
      const result = await change(1, owned[0]!, "replies", {
        expectedVersion: 0,
        expectedLatestMessageId: originalLatest,
        body: "Verified customer reply.",
      });
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        id: owned[0],
        version: 1,
        actorUserId: users[1]!.userId,
        action: "reply",
        messageReceipt: {
          body: "Verified customer reply.",
          enquiryId: owned[0],
          visibility: "CUSTOMER",
          authorType: "STAFF",
        },
      });
      expect(
        (
          await prisma.supportMessage.findUniqueOrThrow({
            where: { id: result.body.data.messageReceipt.id },
          })
        ).body,
      ).toBe("Verified customer reply.");
      expect(
        (
          await change(1, owned[0]!, "replies", {
            expectedVersion: 1,
            expectedLatestMessageId: originalLatest,
            body: "Must not be written.",
          })
        ).status,
      ).toBe(409);
      const legacy = await change(3, owned[1]!, "replies", {
        expectedVersion: 0,
        body: "Compatible older caller.",
      });
      expect(legacy.status).toBe(200);
      const concurrent = await Promise.all(
        ["First concurrent reply.", "Second concurrent reply."].map((body) =>
          change(1, owned[3]!, "replies", {
            expectedVersion: 0,
            expectedLatestMessageId: null,
            body,
          }),
        ),
      );
      expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
    });
    it("records assignment receipts and rejects wrong role, stale version, closed state and missing CSRF", async () => {
      const body = {
        expectedVersion: 0,
        staffId: supervisor.id,
        reason: "Synthetic sales coverage reassignment.",
      };
      expect((await change(3, owned[2]!, "assignment", body)).status).toBe(403);
      expect((await change(2, owned[2]!, "assignment", body, false)).status).toBe(403);
      const result = await change(2, owned[2]!, "assignment", body);
      expect(result.status).toBe(200);
      expect(result.body.data.assignmentReceipt).toEqual({
        staffId: supervisor.id,
        previousStaffId: cashier.id,
        reason: body.reason,
      });
      expect((await change(2, owned[2]!, "assignment", body)).status).toBe(409);
      expect((await get(3, "/" + owned[2])).status).toBe(404);
      expect((await change(2, owned[32]!, "assignment", body)).status).toBe(409);
      expect(
        (
          await change(1, owned[32]!, "replies", {
            expectedVersion: 0,
            body: "Closed reply.",
          })
        ).status,
      ).toBe(409);
    });
    it("rejects unsupported filters, unauthorised accounts and unauthenticated sessions", async () => {
      for (const query of [
        { branchId },
        { limit: 0 },
        { limit: 51 },
        { cursor: "bad" },
        { q: "x".repeat(121) },
        { status: "DRAFT" },
        { type: "toString" },
      ])
        expect((await get(1, "", query)).status).toBe(422);
      for (const index of [0, 7, 10]) expect((await get(index)).status).toBe(403);
      expect((await get(9)).status).toBe(401);
      expect((await request(app).get("/api/v1/staff/workforce/enquiries")).status).toBe(
        401,
      );
    });
    afterAll(async () => {
      try {
        if (guarded) {
          await prisma.session.deleteMany({ where: { id: { in: sessions } } });
          const originalRowsUnchanged = digest(await rows()) === beforeHash,
            auditDelta = (await prisma.auditLog.count()) - auditBefore;
          const temporarySessionsRemaining = await prisma.session.count({
            where: { id: { in: sessions } },
          });
          writeFileSync(
            evidence,
            JSON.stringify({
              originalRowsUnchanged,
              originalCounts: counts,
              successfulReads: reads,
              successfulWrites: writes,
              auditDelta,
              temporarySessionsRemaining,
            }),
          );
          expect(originalRowsUnchanged).toBe(true);
          expect(auditDelta).toBe(reads + writes);
          expect(temporarySessionsRemaining).toBe(0);
        }
      } finally {
        await prisma.$disconnect();
      }
    });
  },
);
