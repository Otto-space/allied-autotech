import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as workforcePolicy from "../../src/modules/organization/workforce.policy.js";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "shared support availability foundation",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    const previousFlag = env.SUPPORT_LIVE_CHAT_ENABLED;
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let owner: { headers: Record<string, string> };
    type Session = { headers: Record<string, string> };
    const presencePath = "/api/v1/staff/workforce/support-chat/presence";
    const getPresence = (actor: Session) =>
      request(app).get(presencePath).set(actor.headers);
    const heartbeat = (actor: Session, expectedVersion = 1) =>
      request(app)
        .post(presencePath + "/heartbeat")
        .set(actor.headers)
        .send({ expectedVersion });
    const setPresence = (actor: Session, expectedVersion = 0, extra: object = {}) =>
      request(app)
        .put(presencePath)
        .set(actor.headers)
        .send({
          expectedVersion,
          branchId: f.home.id,
          available: true,
          capacity: 1,
          ...extra,
        });
    const availability = (branchId?: string, actor?: Session, query = "") =>
      request(app)
        .get(
          `/api/v1/customers/support/live/availability/${branchId ?? f.home.id}${query}`,
        )
        .set((actor ?? f.customer).headers);
    async function coverage(extra: object = {}, branchId?: string) {
      const id = branchId ?? f.home.id;
      const old = await prisma.supportLiveCoverage.findUnique({
        where: { branchId: id },
      });
      return request(app)
        .put(`/api/v1/admin/workforce/support-chat/coverage/${id}`)
        .set(owner.headers)
        .send({
          expectedVersion: old?.version ?? 0,
          enabled: true,
          schedule: {
            timezone: "Africa/Lagos",
            windows: Array.from({ length: 7 }, (_, day) => ({
              day,
              startMinute: 0,
              endMinute: 1440,
            })),
          },
          maxConcurrentPerAgent: 2,
          reason: "Synthetic reviewed support coverage",
          ...extra,
        });
    }
    async function agent(role: "STAFF" | "ADMIN" = "STAFF") {
      const actor = await f.account("CARE_VIEWER", role);
      await f.assignment(actor.user.id, "CARE_RESPONDER");
      await f.assignment(actor.user.id, "CARE_LIVE_AGENT");
      return actor;
    }
    async function activeConversation(
      actor: Awaited<ReturnType<typeof agent>>,
      branchId = f.home.id,
    ) {
      const enquiry = await prisma.enquiry.create({
        data: {
          branchId,
          customerId: f.customer.user.profile!.id,
          name: "Synthetic customer",
          email: f.customer.user.email,
          type: "GENERAL",
          subject: `Synthetic channel ${randomUUID()}`,
          message: "Synthetic canonical question",
          assignedStaffId: f.care.user.staffProfile!.id,
        },
      });
      return prisma.supportConversation.create({
        data: {
          enquiryId: enquiry.id,
          customerId: f.customer.user.profile!.id,
          branchId,
          state: "HUMAN_ACTIVE",
          assignedUserId: actor.user.id,
          assignedSessionId: actor.record.id,
          claimedAt: new Date(),
        },
      });
    }
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      owner = await f.session(f.owner.id, "SUPER_ADMIN");
    }, 60000);
    beforeEach(async () => {
      env.SUPPORT_LIVE_CHAT_ENABLED = true;
      await prisma.supportLivePresence.updateMany({
        where: { branchId: { in: [f.home.id, f.other.id] } },
        data: { available: false },
      });
      await prisma.branch.update({ where: { id: f.home.id }, data: { isActive: true } });
      expect((await coverage()).status).toBe(200);
    });
    afterAll(async () => {
      env.SUPPORT_LIVE_CHAT_ENABLED = previousFlag;
      await prisma.$disconnect();
    });

    it("requires a current customer and reports disabled instead of invented staffing", async () => {
      env.SUPPORT_LIVE_CHAT_ENABLED = false;
      const reply = await availability();
      expect(reply.status).toBe(200);
      expect(reply.body.data.state).toBe("disabled");
      expect(reply.headers["cache-control"]).toBe("private, no-store");
      expect(
        (
          await request(app).get(
            `/api/v1/customers/support/live/availability/${f.home.id}`,
          )
        ).status,
      ).toBe(401);
      expect((await availability(undefined, f.care)).status).toBe(403);
      const a = await agent();
      expect((await setPresence(a)).status).toBe(503);
    });
    it("treats logged-in, eligible staff as unavailable until explicit current opt-in", async () => {
      const a = await agent();
      expect((await availability()).body.data.state).toBe("unavailable");
      const saved = await setPresence(a);
      expect(saved.status).toBe(200);
      expect(saved.body.data).toMatchObject({ version: 1, optedIn: true, capacity: 1 });
      const reply = await availability();
      expect(reply.body.data.state).toBe("available");
      expect(Object.keys(reply.body.data).sort()).toEqual([
        "branchId",
        "channel",
        "checkedAt",
        "kind",
        "state",
      ]);
      expect(reply.body.data.channel).toBe("queued_customer_care");
      expect((await availability(f.other.id)).body.data.state).toBe("unavailable");
    });
    it.each(["STAFF", "ADMIN"] as const)(
      "does not grant %s live duty from role, legacy Care or cross-branch unions",
      async (role) => {
        const noDuty = await f.account(null, role);
        expect((await setPresence(noDuty)).status).toBe(403);
        expect((await setPresence(f.care)).status).toBe(403);
        expect((await setPresence(owner)).status).toBe(403);
        const split = await f.account("CARE_VIEWER", role);
        await f.assignment(split.user.id, "CARE_RESPONDER");
        await f.assignment(split.user.id, "CARE_LIVE_AGENT", false, f.other.id);
        expect((await setPresence(split)).status).toBe(403);
        expect((await setPresence(split, 0, { branchId: f.other.id })).status).toBe(403);
        const liveOnly = await f.account("CARE_VIEWER", role);
        await f.assignment(liveOnly.user.id, "CARE_LIVE_AGENT");
        expect((await setPresence(liveOnly)).status).toBe(403);
      },
    );
    it("restricts coverage to current owner MFA and rejects stale configuration", async () => {
      const path = `/api/v1/admin/workforce/support-chat/coverage/${f.home.id}`;
      expect((await request(app).get(path).set(f.operations.headers)).status).toBe(403);
      expect((await request(app).get(path).set(f.customer.headers)).status).toBe(403);
      const weak = await f.session(f.owner.id, "SUPER_ADMIN", false);
      expect((await request(app).get(path).set(weak.headers)).status).toBe(403);
      expect((await coverage({ expectedVersion: 0 })).status).toBe(409);
      const row = await prisma.auditLog.findFirst({
        where: { entityId: f.home.id, entityType: "BRANCH" },
        orderBy: { createdAt: "desc" },
      });
      expect(row?.newValues).toMatchObject({
        resource: "SUPPORT_LIVE_COVERAGE",
        reason: "Synthetic reviewed support coverage",
      });
    });
    it("enforces CSRF, strict fields, capacity and optimistic revisions", async () => {
      const a = await agent();
      const { "X-CSRF-Token": _csrf, ...headers } = a.headers;
      expect((await setPresence({ headers })).status).toBe(403);
      expect((await setPresence(a, 0, { internalNote: "not allowed" })).status).toBe(422);
      expect((await setPresence(a, 0, { capacity: 3 })).status).toBe(409);
      expect((await setPresence(a)).status).toBe(200);
      expect((await setPresence(a)).status).toBe(409);
      expect((await availability(undefined, undefined, "?waitMinutes=1")).status).toBe(
        422,
      );
    });
    it("serializes simultaneous tab opt-ins into one shared seat record", async () => {
      const a = await agent();
      const replies = await Promise.all([setPresence(a), setPresence(a)]);
      expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.supportLivePresence.count({ where: { userId: a.user.id } }),
      ).toBe(1);
      expect((await getPresence(a)).body.data.version).toBe(1);
    });
    it("renews concurrent heartbeats without incrementing versions or capacity", async () => {
      const a = await agent();
      await setPresence(a);
      await prisma.supportLivePresence.update({
        where: { userId: a.user.id },
        data: { expiresAt: new Date(Date.now() + 20000) },
      });
      const replies = await Promise.all([heartbeat(a), heartbeat(a)]);
      expect(replies.map((r) => r.status)).toEqual([200, 200]);
      expect(
        replies.every((r) => r.body.data.version === 1 && r.body.data.capacity === 1),
      ).toBe(true);
      expect(new Date(replies[1]!.body.data.expiresAt).getTime()).toBeGreaterThan(
        Date.now() + 60000,
      );
    });
    it("binds opt-in to one current session and denies old-session heartbeat resurrection", async () => {
      const a = await agent();
      await setPresence(a);
      const next = await f.session(a.user.id, "STAFF");
      expect((await setPresence(next, 1)).status).toBe(200);
      expect((await heartbeat(a, 2)).status).toBe(409);
      expect((await getPresence(a)).body.data.optedIn).toBe(false);
      expect((await heartbeat(next, 2)).status).toBe(200);
    });
    it("requires a fresh opt-in after lease expiry", async () => {
      const a = await agent();
      await setPresence(a);
      await prisma.supportLivePresence.update({
        where: { userId: a.user.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      expect((await heartbeat(a)).status).toBe(409);
      expect((await availability()).body.data.state).toBe("unavailable");
      expect((await setPresence(a, 1)).body.data.version).toBe(2);
    });
    it("removes an agent revoked between presence lookup and current-account verification", async () => {
      const a = await agent();
      await setPresence(a);
      const original = workforcePolicy.workforceSnapshot;
      const read = vi
        .spyOn(workforcePolicy, "workforceSnapshot")
        .mockImplementation(async (tx, actor) => {
          if (actor.userId === a.user.id)
            await tx.user.update({
              where: { id: a.user.id },
              data: { status: "SUSPENDED" },
            });
          return original(tx, actor);
        });
      try {
        const reply = await availability();
        expect(reply.status).toBe(200);
        expect(reply.body.data.state).toBe("unavailable");
      } finally {
        read.mockRestore();
      }
    });
    it("rechecks revoked duties and permits withdrawal after duties and feature are disabled", async () => {
      const a = await agent();
      await setPresence(a);
      await prisma.workforceAssignment.updateMany({
        where: { userId: a.user.id, template: "CARE_LIVE_AGENT" },
        data: { revokedAt: new Date() },
      });
      expect((await availability()).body.data.state).toBe("unavailable");
      expect((await heartbeat(a)).status).toBe(403);
      env.SUPPORT_LIVE_CHAT_ENABLED = false;
      expect((await setPresence(a, 1, { available: false })).body.data.optedIn).toBe(
        false,
      );
      expect((await heartbeat(a, 2)).status).toBe(409);
    });
    it.each(["revoked", "expired", "unassured"])(
      "does not advertise an agent with a %s session",
      async (state) => {
        const a = await agent();
        await setPresence(a);
        await prisma.session.update({
          where: { id: a.record.id },
          data:
            state === "revoked"
              ? { revokedAt: new Date() }
              : state === "expired"
                ? {
                    expiresAt: new Date(Date.now() - 1),
                    idleExpiresAt: new Date(Date.now() - 1),
                  }
                : { mfaVerifiedAt: null },
        });
        expect((await availability()).body.data.state).toBe("unavailable");
        expect([401, 403]).toContain((await heartbeat(a)).status);
      },
    );
    it("rechecks support hours independently of workshop hours", async () => {
      const a = await agent();
      await setPresence(a);
      const day = new Date(Date.now() + 3600000).getUTCDay();
      expect(
        (
          await coverage({
            schedule: {
              timezone: "Africa/Lagos",
              windows: [{ day: (day + 1) % 7, startMinute: 0, endMinute: 1440 }],
            },
          })
        ).status,
      ).toBe(200);
      expect((await availability()).body.data.state).toBe("after_hours");
      expect((await heartbeat(a)).status).toBe(503);
    });
    it("counts active capacity across branches without changing canonical case assignment", async () => {
      const a = await agent();
      await setPresence(a);
      const live = await activeConversation(a, f.other.id);
      expect((await availability()).body.data.state).toBe("unavailable");
      const caseRow = await prisma.enquiry.findUniqueOrThrow({
        where: { id: live.enquiryId! },
      });
      expect(caseRow.assignedStaffId).toBe(f.care.user.staffProfile!.id);
      await prisma.supportConversation.update({
        where: { id: live.id },
        data: {
          state: "ENDED",
          assignedUserId: null,
          assignedSessionId: null,
          endedAt: new Date(),
          endReason: "SYNTHETIC_END",
        },
      });
      expect((await availability()).body.data.state).toBe("available");
    });
    it("applies reduced current coverage capacity immediately", async () => {
      const a = await agent();
      expect((await setPresence(a, 0, { capacity: 2 })).status).toBe(200);
      await activeConversation(a);
      expect((await availability()).body.data.state).toBe("available");
      expect((await coverage({ maxConcurrentPerAgent: 1 })).status).toBe(200);
      expect((await availability()).body.data.state).toBe("unavailable");
      expect((await heartbeat(a)).status).toBe(409);
    });
    it("does not retain availability after a branch is disabled", async () => {
      const a = await agent();
      await setPresence(a);
      await prisma.branch.update({ where: { id: f.home.id }, data: { isActive: false } });
      expect((await availability()).status).toBe(404);
      expect((await heartbeat(a)).status).toBe(404);
      expect((await setPresence(a, 1, { available: false })).status).toBe(200);
    });
    it("rejects direct invalid capacity, schedule and channel state writes", async () => {
      const a = await agent();
      await setPresence(a);
      await expect(
        prisma.supportLivePresence.update({
          where: { userId: a.user.id },
          data: { capacity: 0 },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.supportLiveCoverage.update({
          where: { branchId: f.home.id },
          data: { schedule: {} },
        }),
      ).rejects.toThrow();
      const base = { customerId: f.customer.user.profile!.id, branchId: f.home.id };
      await expect(prisma.supportConversation.create({ data: base })).rejects.toThrow();
      const e = await prisma.enquiry.create({
        data: {
          ...base,
          name: "Synthetic",
          email: f.customer.user.email,
          subject: `Synthetic invalid channel ${randomUUID()}`,
          message: "Synthetic",
          type: "GENERAL",
        },
      });
      await expect(
        prisma.supportConversation.create({
          data: { ...base, enquiryId: e.id, state: "HUMAN_ACTIVE" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.supportConversation.create({
          data: { ...base, enquiryId: e.id, state: "ENDED" },
        }),
      ).rejects.toThrow();
    });
  },
);
