import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
const app = createApp({ checkReadiness: async () => undefined }),
  sessions: string[] = [];
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "workshop privacy review",
  () => {
    let reviewer: { id: string; headers: Record<string, string> },
      customer: { id: string; headers: Record<string, string> },
      denied: { id: string; headers: Record<string, string> };
    async function account(role: "ADMIN" | "CUSTOMER", granted = false) {
      const user = await prisma.user.create({
        data: {
          email: `privacy-review-${randomUUID()}@example.test`,
          passwordHash: "unusable-qa-only",
          role,
          emailVerifiedAt: new Date(),
          ...(role === "ADMIN"
            ? {
                staffProfile: {
                  create: { firstName: "Synthetic", lastName: "Reviewer" },
                },
              }
            : {}),
        },
      });
      if (granted) {
        const owner = await prisma.user.findFirstOrThrow({
          where: { role: "SUPER_ADMIN" },
          select: { id: true },
        });
        await prisma.userCapability.create({
          data: {
            userId: user.id,
            capability: "PRIVACY_REVIEW",
            grantedByUserId: owner.id,
          },
        });
      }
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiry = new Date(Date.now() + 3600000),
        session = await prisma.session.create({
          data: {
            userId: user.id,
            createdAt: new Date(Date.now() - 1000),
            tokenHash: hashToken("session", token),
            csrfTokenHash: hashToken("csrf", csrf),
            expiresAt: expiry,
            idleExpiresAt: expiry,
            mfaRequired: role !== "CUSTOMER",
            mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
          },
        });
      sessions.push(session.id);
      return {
        id: user.id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "x-csrf-token": csrf,
        },
      };
    }
    const get = (path: string, actor = reviewer) =>
        request(app).get(`/api/v1${path}`).set(actor.headers),
      post = (path: string, body: unknown) =>
        request(app).post(`/api/v1${path}`).set(reviewer.headers).send(body);
    const makeRequest = () =>
      prisma.privacyRequest.create({
        data: {
          userId: customer.id,
          kind: "DELETION",
          reason: "Synthetic review explanation",
        },
      });
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
      reviewer = await account("ADMIN", true);
      customer = await account("CUSTOMER");
      denied = await account("ADMIN");
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    it("filters and pages exact accounts without exposing private audit values", async () => {
      await prisma.privacyRequest.createMany({
        data: Array.from({ length: 28 }, (_, n) => ({
          userId: customer.id,
          kind: "ANONYMIZATION" as const,
          status: "UNDER_REVIEW" as const,
          reason: "Synthetic paged review reason",
          reviewedAt: new Date("2026-10-18T09:00:37.123Z"),
          reviewNote: "Synthetic current review note",
          createdAt: new Date(Date.now() - 60000 + n * 10),
        })),
      });
      const base = `/staff/privacy-requests?userId=${customer.id}&kind=ANONYMIZATION&status=UNDER_REVIEW&limit=25`,
        a = await get(base);
      expect(a.status).toBe(200);
      expect(a.headers["cache-control"]).toBe("private, no-store");
      expect(a.body.data.items).toHaveLength(25);
      expect(
        a.body.data.items.every(
          (r: { userId: string; kind: string; status: string; reviewedAt: string }) =>
            r.userId === customer.id &&
            r.kind === "ANONYMIZATION" &&
            r.status === "UNDER_REVIEW" &&
            r.reviewedAt === "2026-10-18T09:00:37.123Z",
        ),
      ).toBe(true);
      const b = await get(base + `&cursor=${a.body.data.nextCursor}`);
      expect(b.body.data.items).toHaveLength(3);
      expect(b.body.data.nextCursor).toBeNull();
      expect((await get(base + "&search=unsupported")).status).toBe(422);
      expect((await get(base, customer)).status).toBe(403);
      expect((await get(base, denied)).status).toBe(403);
      expect((await request(app).get("/api/v1/staff/privacy-requests")).status).toBe(401);
      const audits = await prisma.auditLog.findMany({
        where: { userId: reviewer.id, action: "READ", entityId: customer.id },
        select: { newValues: true },
      });
      expect(audits).toHaveLength(2);
      expect(audits.map((a) => a.newValues)).toEqual([
        { collection: "PRIVACY_REQUEST", resultCount: 25 },
        { collection: "PRIVACY_REQUEST", resultCount: 3 },
      ]);
    });
    it("retains exact review timestamps and rejects stale responses without deletion", async () => {
      const row = await makeRequest(),
        path = `/staff/privacy-requests/${row.id}/review`,
        body = {
          status: "UNDER_REVIEW",
          note: "Exact reviewed customer-visible response",
          expectedReviewedAt: null,
        },
        a = await post(path, body);
      expect(a.status).toBe(200);
      expect(a.body.data.reviewNote).toBe(body.note);
      expect(a.body.data.reviewedAt).not.toBeNull();
      expect((await post(path, body)).status).toBe(409);
      const b = await post(path, {
        ...body,
        status: "REJECTED",
        expectedReviewedAt: a.body.data.reviewedAt,
      });
      expect(b.status).toBe(200);
      expect(Date.parse(b.body.data.reviewedAt)).toBeGreaterThan(
        Date.parse(a.body.data.reviewedAt),
      );
      expect(await prisma.user.count({ where: { id: customer.id } })).toBe(1);
    });
    it("creates exact holds and releases once with a scoped audited reason", async () => {
      const body = {
          userId: customer.id,
          recordType: "ALL",
          reason: "Synthetic documented accounting protection",
        },
        created = await post("/staff/retention-holds", body);
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({
        ...body,
        recordId: null,
        releasedAt: null,
      });
      const id = created.body.data.id,
        reason = "Documented accounting clearance permits release",
        replies = await Promise.all([
          post(`/staff/retention-holds/${id}/release`, { reason }),
          post(`/staff/retention-holds/${id}/release`, { reason }),
        ]);
      expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(replies.find((r) => r.status === 200)!.body.data).toMatchObject({
        id,
        userId: customer.id,
        releaseReason: reason,
        releasedAt: expect.any(String),
      });
      expect(
        await prisma.auditLog.count({
          where: {
            userId: reviewer.id,
            action: "UPDATE",
            newValues: { path: ["releasedHoldId"], equals: id },
          },
        }),
      ).toBe(1);
    });
    it("waits for the account protection lock then rejects approval after a committed hold", async () => {
      const row = await makeRequest();
      let unlock!: () => void, locked!: () => void;
      const acquired = new Promise<void>((r) => {
          locked = r;
        }),
        release = new Promise<void>((r) => {
          unlock = r;
        });
      const transaction = prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`privacy:${customer.id}`},0))`;
        await tx.retentionHold.create({
          data: {
            userId: customer.id,
            recordType: "ALL",
            reason: "Concurrent synthetic protection",
            createdByUserId: reviewer.id,
          },
        });
        locked();
        await release;
      });
      await acquired;
      let settled = false;
      const response = post(`/staff/privacy-requests/${row.id}/review`, {
        status: "APPROVED_PENDING_POLICY",
        note: "Synthetic proposed approval response",
        expectedReviewedAt: null,
      }).then((r) => {
        settled = true;
        return r;
      });
      try {
        await new Promise((r) => setTimeout(r, 100));
        expect(settled).toBe(false);
      } finally {
        unlock();
        await transaction;
      }
      expect((await response).status).toBe(409);
      expect(
        (await prisma.privacyRequest.findUniqueOrThrow({ where: { id: row.id } }))
          .reviewedAt,
      ).toBeNull();
    });
    it("reports latest100 honestly while older active holds still prevent approval", async () => {
      const owner = await account("CUSTOMER"),
        row = await prisma.privacyRequest.create({
          data: {
            userId: owner.id,
            kind: "DELETION",
            reason: "Synthetic older hold review",
          },
        }),
        createdAt = new Date(Date.now() - 100000);
      await prisma.retentionHold.create({
        data: {
          userId: owner.id,
          recordType: "ALL",
          reason: "Older active protection must still apply",
          createdByUserId: reviewer.id,
          createdAt,
        },
      });
      await prisma.retentionHold.createMany({
        data: Array.from({ length: 100 }, (_, n) => ({
          userId: owner.id,
          recordType: "ACCOUNT" as const,
          reason: "Synthetic released hold history",
          createdByUserId: reviewer.id,
          createdAt: new Date(createdAt.getTime() + 1000 + n),
          releasedAt: new Date(),
          releasedByUserId: reviewer.id,
        })),
      });
      const result = await get(`/staff/retention-holds?userId=${owner.id}`);
      expect(result.status).toBe(200);
      expect(result.body.data).toHaveLength(100);
      expect(
        result.body.data.every(
          (r: { releasedAt: string | null }) => r.releasedAt !== null,
        ),
      ).toBe(true);
      expect(result.headers["cache-control"]).toBe("private, no-store");
      expect(
        (
          await post(`/staff/privacy-requests/${row.id}/review`, {
            status: "APPROVED_PENDING_POLICY",
            note: "Synthetic approval must respect all protections",
            expectedReviewedAt: null,
          })
        ).status,
      ).toBe(409);
    });
  },
);
