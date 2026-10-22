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
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "managed complaint workspace",
  () => {
    const evidence = process.env.WORKFORCE_COMPLAINTS_EVIDENCE!;
    const fixturePath = process.env.WORKFORCE_COMPLAINTS_FIXTURES!;
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
    let originalLatest: string, internalId: string;
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
        prisma.enquiry.findMany({ orderBy: { id: "asc" } }),
        prisma.complaint.findMany({
          where: { id: { notIn: owned } },
          orderBy: { id: "asc" },
        }),
        prisma.supportMessage.findMany({
          where: { OR: [{ complaintId: null }, { complaintId: { notIn: owned } }] },
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
        .get("/api/v1/staff/workforce/complaints" + suffix)
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
      action: "replies",
      body: Record<string, unknown>,
      csrf = true,
    ) {
      const headers = { ...identities[index] };
      if (!csrf) delete headers["x-csrf-token"];
      const result = await request(app)
        .post(`/api/v1/staff/workforce/complaints/${id}/${action}`)
        .set(headers)
        .send(body);
      if (result.status === 200) {
        writes++;
        expect(
          workforceResponseSchema("complaintReply").safeParse(result.body.data).success,
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

      const resumeMode = process.env.WORKFORCE_COMPLAINTS_RESUME_UNSENT;
      const resumeUnsent = resumeMode === "true" || resumeMode === "rejections";
      if (existsSync(evidence) || (existsSync(fixturePath) && !resumeUnsent))
        throw Error(
          "Complaint evidence or fixtures exist; inspect before repeating writes",
        );
      if (resumeUnsent) {
        const previous = JSON.parse(
          readFileSync(process.env.WORKFORCE_COMPLAINTS_PRIOR_EVIDENCE!, "utf8"),
        );
        const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
        expect(previous.successfulWrites).toBe(resumeMode === "rejections" ? 3 : 0);
        expect(previous.originalRowsUnchanged).toBe(true);
        expect(previous.temporarySessionsRemaining).toBe(0);
        expect(fixture.setupComplete).toBe(true);
        owned.push(...fixture.owned);
        originalLatest = fixture.originalLatest;
        internalId = fixture.internalId;
        expect(
          await prisma.complaint.count({ where: { id: { in: owned }, version: 0 } }),
        ).toBe(resumeMode === "rejections" ? 31 : 34);
        expect(
          await prisma.supportMessage.count({ where: { complaintId: { in: owned } } }),
        ).toBe(resumeMode === "rejections" ? 32 : 28);
        expect(digest(await rows())).toBe(fixture.beforeHash);
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
      const before = await rows();
      beforeHash = digest(before);
      counts = before.map((r) => r.length);
      auditBefore = await prisma.auditLog.count();
      guarded = true;
      if (!resumeUnsent) {
        // Dedicated synthetic records; retained historical fixtures are never mutated.
        for (let i = 0; i < 34; i++) owned.push(randomUUID());
        writeFileSync(
          fixturePath,
          JSON.stringify({ owned, branchId, beforeHash, counts, setupComplete: false }),
        );
        await prisma.complaint.createMany({
          data: owned.map((id, i) => ({
            id,
            branchId: i === 33 ? foreignBranch : branchId,
            priority: i === 30 ? "URGENT" : "MEDIUM",
            subject: `Synthetic milestone108 complaint ${i}${i === 0 ? " literal %_" : ""}`,
            description: "Synthetic customer-visible complaint text.",
            name: "Synthetic Complaint Customer",
            email: "complaint108@example.test",
            status: i === 32 ? "CLOSED" : i === 31 ? "RESOLVED" : "OPEN",
            resolution: i === 31 || i === 32 ? "Synthetic recorded resolution." : null,
            acknowledgedAt: i === 0 ? new Date() : null,
            acknowledgementDueAt: i === 0 ? new Date(Date.now() + 3600000) : null,
            closedAt: i === 32 ? new Date() : null,
            resolvedAt: i === 31 || i === 32 ? new Date() : null,
          })),
        });
        const messageIds = Array.from({ length: 28 }, () => randomUUID());
        originalLatest = messageIds[26]!;
        internalId = messageIds[27]!;
        await prisma.supportMessage.createMany({
          data: messageIds.map((id, i) => ({
            id,
            complaintId: owned[0]!,
            authorUserId: users[1]!.userId,
            authorType: i === 27 ? "STAFF" : "CUSTOMER",
            visibility: i === 27 ? "INTERNAL" : "CUSTOMER",
            body:
              i === 27
                ? "private-internal-q108"
                : "Synthetic visible-history-q108 message " + i,
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
      }
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
    it("restricts discovery/detail to current Customer Service branches and minimal public conversation fields", async () => {
      const response = await get(1, "", { q: "milestone108", limit: 50 });
      expect(response.status).toBe(200);
      expect(
        workforceResponseSchema("complaints").safeParse(response.body.data).success,
      ).toBe(true);
      expect(response.body.data.items).toHaveLength(33);
      for (const row of response.body.data.items) {
        expect(row.branchId).toBe(branchId);
        expect(row.branch.id).toBe(branchId);
        for (const field of [
          "name",
          "email",
          "phone",
          "customerId",
          "assignedStaffId",
          "bookingId",
          "orderId",
          "vehicleTransactionId",
          "slaPolicySnapshot",
        ])
          expect(row).not.toHaveProperty(field);
      }
      expect((await get(1, "/" + owned[33])).status).toBe(404);
      for (const index of [0, 2, 3, 7, 10]) {
        expect((await get(index)).status).toBe(403);
        expect((await get(index, "/" + owned[0])).status).toBe(403);
      }
      expect((await get(9)).status).toBe(401);
      expect((await request(app).get("/api/v1/staff/workforce/complaints")).status).toBe(
        401,
      );
    });
    it("pages combined priority/status discovery and treats search literals without leaking internal messages", async () => {
      const all: string[] = [];
      let cursor: string | undefined;
      do {
        const response = await get(1, "", {
          q: "milestone108",
          limit: 7,
          ...(cursor ? { cursor } : {}),
        });
        expect(response.status).toBe(200);
        all.push(...response.body.data.items.map((r: { id: string }) => r.id));
        cursor = response.body.data.nextCursor;
        expect(all.length).toBeLessThanOrEqual(33);
      } while (cursor);
      expect(all).toEqual(owned.slice(0, 33).sort());
      for (const q of ["%_", "visible-history-q108", "milestone108 literal"]) {
        const response = await get(1, "", { q });
        expect(response.status).toBe(200);
        expect(response.body.data.items.map((r: { id: string }) => r.id)).toEqual([
          owned[0],
        ]);
      }
      expect((await get(1, "", { q: "private-internal-q108" })).body.data.items).toEqual(
        [],
      );
      expect(
        (
          await get(1, "", { q: "milestone108", priority: "URGENT", status: "OPEN" })
        ).body.data.items.map((r: { id: string }) => r.id),
      ).toEqual([owned[30]]);
    });
    it("reads recorded tracking/resolution and pages only customer-visible history with owned cursors", async () => {
      const first = await get(1, "/" + owned[0], { limit: 25 });
      expect(first.status).toBe(200);
      expect(
        workforceResponseSchema("complaint").safeParse(first.body.data).success,
      ).toBe(true);
      expect(first.body.data.latestMessageId).toBe(originalLatest);
      expect(first.body.data.acknowledgedAt).not.toBeNull();
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
      const resolved = await get(1, "/" + owned[31]);
      expect(resolved.body.data.resolution).toBe("Synthetic recorded resolution.");
    });
    it("records one exact reply receipt and rejects duplicate version or changed latest-message preconditions", async () => {
      const result = await change(1, owned[0]!, "replies", {
        expectedVersion: 0,
        expectedLatestMessageId: originalLatest,
        body: "Verified complaint reply.",
      });
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        id: owned[0],
        version: 1,
        actorUserId: users[1]!.userId,
        branchId,
        action: "reply",
        messageReceipt: {
          body: "Verified complaint reply.",
          complaintId: owned[0],
          visibility: "CUSTOMER",
          authorType: "STAFF",
        },
      });
      const saved = await prisma.supportMessage.findUniqueOrThrow({
        where: { id: result.body.data.messageReceipt.id },
      });
      expect(saved.body).toBe("Verified complaint reply.");
      expect(saved.authorUserId).toBe(users[1]!.userId);
      for (const expectedVersion of [0, 1])
        expect(
          (
            await change(1, owned[0]!, "replies", {
              expectedVersion,
              expectedLatestMessageId: originalLatest,
              body: "Must not be saved.",
            })
          ).status,
        ).toBe(409);
      // Simulate a compatible message writer that does not increment parent.version.
      await prisma.supportMessage.create({
        data: {
          complaintId: owned[2]!,
          authorUserId: users[1]!.userId,
          authorType: "STAFF",
          visibility: "CUSTOMER",
          body: "Synthetic competing message.",
        },
      });
      expect(
        (
          await change(1, owned[2]!, "replies", {
            expectedVersion: 0,
            expectedLatestMessageId: null,
            body: "Stale conversation.",
          })
        ).status,
      ).toBe(409);
    });
    it("preserves older caller compatibility and serializes concurrent replies", async () => {
      expect(
        (
          await change(1, owned[1]!, "replies", {
            expectedVersion: 0,
            body: "Compatible older caller.",
          })
        ).status,
      ).toBe(200);
      const results = await Promise.all(
        ["Concurrent first.", "Concurrent second."].map((body) =>
          change(1, owned[3]!, "replies", {
            expectedVersion: 0,
            expectedLatestMessageId: null,
            body,
          }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.supportMessage.count({ where: { complaintId: owned[3]! } }),
      ).toBe(1);
    });
    it("rejects closed/resolved, wrong role/branch, missing CSRF and malformed requests without writes", async () => {
      const body = { expectedVersion: 0, body: "Must not be saved." };
      for (const i of [31, 32])
        expect((await change(1, owned[i]!, "replies", body)).status).toBe(409);
      expect((await change(1, owned[33]!, "replies", body)).status).toBe(404);
      expect((await change(2, owned[4]!, "replies", body)).status).toBe(403);
      expect((await change(1, owned[4]!, "replies", body, false)).status).toBe(403);
      for (const bad of [
        { ...body, body: " " },
        { ...body, body: "x".repeat(5001) },
        { ...body, expectedLatestMessageId: "invalid" },
        { ...body, visibility: "INTERNAL" },
      ])
        expect((await change(1, owned[4]!, "replies", bad)).status).toBe(422);
      for (const query of [
        { q: " " },
        { q: "x".repeat(121) },
        { q: "a\u0000b" },
        { priority: "CRITICAL" },
        { status: "IN_PROGRESS" },
        { limit: 51 },
        { cursor: "invalid" },
        { customerId: users[10]!.userId },
      ])
        expect((await get(1, "", query)).status).toBe(422);
      expect(
        await prisma.supportMessage.count({ where: { complaintId: owned[4]! } }),
      ).toBe(0);
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
