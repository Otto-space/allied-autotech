import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { SupportChannelWorker } from "../../src/workers/support-channel.worker.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "shared channel discovery, recovery and quiet reconciliation",
  () => {
    let app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>, branch: { id: string };
    let customer: Awaited<ReturnType<typeof workforceFixture>>["customer"];
    const beforeFlag = env.SUPPORT_LIVE_CHAT_ENABLED;
    const work = "/api/v1/staff/workforce/support-chat/channels",
      own = "/api/v1/customers/support/live/channels";
    const key = () => `support-reply-v1.${Date.now()}.${randomUUID()}`;
    type Session = { headers: Record<string, string> };
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
    }, 60000);
    beforeEach(async () => {
      app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      env.SUPPORT_LIVE_CHAT_ENABLED = true;
      customer = await f.account(null, "CUSTOMER");
      branch = await prisma.branch.create({
        data: {
          code: "CHAT-" + randomUUID().slice(0, 8),
          name: "Synthetic channel branch",
          address: "Synthetic test address",
          city: "Test",
          state: "Test",
        },
      });
      await prisma.supportLiveCoverage.create({
        data: {
          branchId: branch.id,
          enabled: true,
          updatedByUserId: f.owner.id,
          maxConcurrentPerAgent: 2,
          schedule: {
            timezone: "Africa/Lagos",
            windows: Array.from({ length: 7 }, (_, day) => ({
              day,
              startMinute: 0,
              endMinute: 1440,
            })),
          },
        },
      });
    });
    afterAll(async () => {
      env.SUPPORT_LIVE_CHAT_ENABLED = beforeFlag;
      await prisma.$disconnect();
    });
    async function operator(live = false, assign = false, branchId = branch.id) {
      const actor = await f.account("CARE_VIEWER", "STAFF", branchId);
      if (live) {
        await f.assignment(actor.user.id, "CARE_RESPONDER", false, branchId);
        await f.assignment(actor.user.id, "CARE_LIVE_AGENT", false, branchId);
      }
      if (assign) await f.assignment(actor.user.id, "CARE_ASSIGNER", false, branchId);
      if (live)
        expect(
          (
            await request(app)
              .put("/api/v1/staff/workforce/support-chat/presence")
              .set(actor.headers)
              .send({ expectedVersion: 0, available: true, capacity: 1, branchId })
          ).status,
        ).toBe(200);
      return actor;
    }
    async function channel(
      kind: "ENQUIRY" | "COMPLAINT" = "ENQUIRY",
      branchId = branch.id,
    ) {
      const base = {
        branchId,
        customerId: customer.user.profile!.id,
        subject: "Synthetic channel " + randomUUID(),
      };
      const target =
        kind === "ENQUIRY"
          ? await prisma.enquiry.create({
              data: {
                ...base,
                type: "GENERAL",
                name: "Synthetic",
                email: customer.user.email,
                message: "Synthetic original question",
              },
            })
          : await prisma.complaint.create({
              data: { ...base, description: "Synthetic complaint" },
            });
      const operationKey = key();
      const saved = await request(app)
        .post(own)
        .set(customer.headers)
        .set("Idempotency-Key", operationKey)
        .send({
          target: { kind, id: target.id },
          expectedCaseVersion: 0,
          expectedChannelVersion: 0,
        });
      expect(saved.status).toBe(201);
      return { ...saved.body.data, operationKey };
    }
    const list = (actor: Session, query: Record<string, string | number> = {}) =>
      request(app)
        .get(work)
        .set(actor.headers)
        .query({ branchId: branch.id, ...query });
    const act = (id: string, actor: Session, body: object, operationKey = key()) =>
      request(app)
        .post(`${work}/${id}/actions`)
        .set(actor.headers)
        .set("Idempotency-Key", operationKey)
        .send(body);

    it("returns only currently scoped case metadata and keeps view separate from live authority", async () => {
      const viewer = await operator(),
        enquiry = await channel(),
        complaint = await channel("COMPLAINT");
      const foreign = await channel("ENQUIRY", f.other.id);
      const page = await list(viewer);
      expect(page.status).toBe(200);
      expect(page.body.data.items.map((x: { id: string }) => x.id).sort()).toEqual(
        [enquiry.id, complaint.id].sort(),
      );
      expect(page.body.data.items.every((x: { canClaim: boolean }) => !x.canClaim)).toBe(
        true,
      );
      expect(JSON.stringify(page.body)).not.toMatch(
        /customerId|email|sessionId|assignedUserId/,
      );
      expect(JSON.stringify(page.body)).not.toContain(foreign.id);
      expect((await list(viewer, { branchId: f.other.id })).status).toBe(403);
      expect((await list(customer)).status).toBe(403);
      expect((await list(viewer, { limit: 100 })).status).toBe(422);
    });
    it("paginates stable timestamp ties without duplicates and binds cursors to access, session and filters", async () => {
      const viewer = await operator(),
        rows = [await channel(), await channel(), await channel()];
      const instant = new Date(Date.now() - 1000);
      await prisma.supportConversation.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { createdAt: instant },
      });
      const one = await list(viewer, { limit: 1 });
      expect(one.status).toBe(200);
      const cursor = one.body.data.nextCursor;
      expect(cursor).toBeTruthy();
      expect((await list(viewer, { limit: 1, cursor, state: "QUEUED" })).status).toBe(
        422,
      );
      const other = await operator();
      expect((await list(other, { limit: 1, cursor })).status).toBe(422);
      const nextSession = await f.session(viewer.user.id, "STAFF");
      expect((await list(nextSession, { limit: 1, cursor })).status).toBe(422);
      const ids = [one.body.data.items[0].id];
      let next = cursor;
      while (next) {
        const page = await list(viewer, { limit: 1, cursor: next });
        expect(page.status).toBe(200);
        ids.push(...page.body.data.items.map((r: { id: string }) => r.id));
        next = page.body.data.nextCursor;
      }
      expect(ids).toEqual(rows.map((r) => r.id).sort());
      expect(new Set(ids).size).toBe(3);
      const changed = cursor.slice(0, -1) + (cursor.endsWith("a") ? "b" : "a");
      expect((await list(viewer, { cursor: changed })).status).toBe(422);
      await prisma.workforceAssignment.updateMany({
        where: { userId: viewer.user.id },
        data: { revokedAt: new Date() },
      });
      expect((await list(viewer, { cursor })).status).toBe(403);
    });
    it("exposes only a public message anchor for new-update indicators", async () => {
      const saved = await channel();
      const visible = await prisma.supportMessage.findFirstOrThrow({
        where: { enquiryId: saved.target.id, visibility: "CUSTOMER" },
      });
      const privateNote = await prisma.supportMessage.create({
        data: {
          enquiryId: saved.target.id,
          authorUserId: f.owner.id,
          authorType: "STAFF",
          kind: "INTERNAL_NOTE",
          visibility: "INTERNAL",
          body: "INTERNAL-SYNTHETIC-ANCHOR",
          createdAt: new Date(visible.createdAt.getTime() + 1),
        },
      });
      const current = await request(app).get(`${own}/${saved.id}`).set(customer.headers);
      expect(current.status).toBe(200);
      expect(current.body.data.latestPublicMessageId).toBe(visible.id);
      expect(JSON.stringify(current.body)).not.toContain(privateNote.id);
      expect(JSON.stringify(current.body)).not.toContain(privateNote.body);
    });
    it("continues a short page after a closed case leaves the selected queue", async () => {
      const viewer = await operator(),
        first = await channel(),
        second = await channel();
      await prisma.enquiry.update({
        where: { id: first.target.id },
        data: { status: "CLOSED", resolvedAt: new Date(), closedAt: new Date() },
      });
      const page = await list(viewer, { state: "QUEUED", limit: 1 });
      expect(page.status).toBe(200);
      expect(page.body.data.items).toEqual([]);
      expect(page.body.data.nextCursor).toBeTruthy();
      const next = await list(viewer, {
        state: "QUEUED",
        limit: 1,
        cursor: page.body.data.nextCursor,
      });
      expect(next.body.data.items.map((r: { id: string }) => r.id)).toEqual([second.id]);
    });
    it("offers only available eligible transfer candidates under separate assignment authority", async () => {
      const assigner = await operator(true, true),
        one = await operator(true),
        two = await operator(true);
      const viewer = await operator(),
        caseRow = await channel();
      await act(caseRow.id, assigner, { action: "claim", expectedVersion: 1 });
      expect(
        (await request(app).get(`${work}/${caseRow.id}/assignees`).set(viewer.headers))
          .status,
      ).toBe(403);
      const first = await request(app)
        .get(`${work}/${caseRow.id}/assignees?limit=1`)
        .set(assigner.headers);
      expect(first.status).toBe(200);
      expect(first.body.data.items).toHaveLength(1);
      expect(first.body.data.nextCursor).toBeTruthy();
      const second = await request(app)
        .get(`${work}/${caseRow.id}/assignees`)
        .set(assigner.headers)
        .query({ limit: 1, cursor: first.body.data.nextCursor });
      expect(
        [...first.body.data.items, ...second.body.data.items]
          .map((r: { staffId: string }) => r.staffId)
          .sort(),
      ).toEqual([one.user.staffProfile!.id, two.user.staffProfile!.id].sort());
      expect(Object.keys(first.body.data.items[0]).sort()).toEqual(["name", "staffId"]);
      await prisma.supportLivePresence.update({
        where: { userId: one.user.id },
        data: { available: false },
      });
      const fresh = await request(app)
        .get(`${work}/${caseRow.id}/assignees`)
        .set(assigner.headers);
      expect(fresh.body.data.items.map((r: { staffId: string }) => r.staffId)).toEqual([
        two.user.staffProfile!.id,
      ]);
    });
    it("recovers a saved private transfer after reload without returning its reason or requiring its body", async () => {
      const a = await operator(true, true),
        b = await operator(true),
        saved = await channel();
      await act(saved.id, a, { action: "claim", expectedVersion: 1 });
      const operationKey = key();
      const reason = "INTERNAL-SYNTHETIC-TRANSFER-REASON";
      expect(
        (
          await act(
            saved.id,
            a,
            {
              action: "transfer",
              expectedVersion: 2,
              targetStaffId: b.user.staffProfile!.id,
              reason,
            },
            operationKey,
          )
        ).status,
      ).toBe(200);
      const session = await f.session(a.user.id, "STAFF");
      const recovered = await request(app)
        .get(`${work}/operations/transfer/${operationKey}`)
        .set(session.headers);
      expect(recovered.status).toBe(200);
      expect(recovered.body.data).toMatchObject({
        state: "SAVED",
        action: "transfer",
        channel: { id: saved.id, state: "HUMAN_ACTIVE" },
      });
      expect(JSON.stringify(recovered.body)).not.toMatch(
        /INTERNAL-SYNTHETIC|targetStaffId|assistantContext/,
      );
      expect(
        (
          await request(app)
            .get(`${work}/operations/transfer/${operationKey}`)
            .set(b.headers)
        ).status,
      ).toBe(404);
      await prisma.workforceAssignment.updateMany({
        where: { userId: a.user.id, template: "CARE_ASSIGNER" },
        data: { revokedAt: new Date() },
      });
      expect(
        (
          await request(app)
            .get(`${work}/operations/transfer/${operationKey}`)
            .set(session.headers)
        ).status,
      ).toBe(403);
    });
    it("recovers customer requests only for their owner and distinguishes unknown and expired operations", async () => {
      const saved = await channel(),
        path = `${own}/operations/request/${saved.operationKey}`;
      const result = await request(app).get(path).set(customer.headers);
      expect(result.status).toBe(200);
      expect(result.body.data.channel.id).toBe(saved.id);
      expect((await request(app).get(path).set(f.stranger.headers)).status).toBe(404);
      const unknown = await request(app)
        .get(`${own}/operations/request/${key()}`)
        .set(customer.headers);
      expect(unknown.status).toBe(404);
      expect(unknown.body.message).toContain("does not prove");
      const expired = `support-reply-v1.${Date.now() - 86400001}.${randomUUID()}`;
      expect(
        (
          await request(app)
            .get(`${own}/operations/request/${expired}`)
            .set(customer.headers)
        ).status,
      ).toBe(409);
    });
    it("reconciles quiet channels fairly across unchanged earlier pages and restarts", async () => {
      const a = await operator(true),
        prefix = await channel(),
        joined = await channel();
      await act(joined.id, a, { action: "claim", expectedVersion: 1 });
      await prisma.supportLivePresence.update({
        where: { userId: a.user.id },
        data: { available: false },
      });
      const name = "support-channel-reconcile:v1";
      await prisma.workerScanCheckpoint.upsert({
        where: { name },
        create: { name },
        update: { afterCreatedAt: null, afterId: null },
      });
      const maximum = await prisma.supportConversation.count({
        where: { state: { not: "ENDED" } },
      });
      let scanned = 0;
      for (let i = 0; i <= maximum; i++) {
        const batch = await new SupportChannelWorker().runOnce(1);
        expect(batch.skipped).toBe(false);
        expect(batch.scanned).toBeLessThanOrEqual(1);
        scanned += batch.scanned;
        if (
          (
            await prisma.supportConversation.findUniqueOrThrow({
              where: { id: joined.id },
            })
          ).state === "QUEUED"
        )
          break;
      }
      expect(scanned).toBeGreaterThan(1);
      expect(
        (await prisma.supportConversation.findUniqueOrThrow({ where: { id: joined.id } }))
          .state,
      ).toBe("QUEUED");
      expect(
        (await prisma.supportConversation.findUniqueOrThrow({ where: { id: prefix.id } }))
          .version,
      ).toBe(1);
      const before = await prisma.supportMessage.count({
        where: { enquiryId: joined.target.id },
      });
      await new SupportChannelWorker().runOnce(10);
      expect(
        await prisma.supportMessage.count({ where: { enquiryId: joined.target.id } }),
      ).toBe(before);
    });
    it("does not wait on another process's access/claim lock", async () => {
      let acquired: (() => void) | undefined, release: (() => void) | undefined;
      const ready = new Promise<void>((resolve) => {
          acquired = resolve;
        }),
        hold = new Promise<void>((resolve) => {
          release = resolve;
        });
      const locked = prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('organization-access',0))`;
        acquired!();
        await hold;
      });
      try {
        await ready;
        expect(await new SupportChannelWorker().runOnce()).toMatchObject({
          skipped: true,
          scanned: 0,
        });
      } finally {
        release!();
        await locked;
      }
    });
    it("durably cancels an unsaved claim and rejects its delayed original without losing the case", async () => {
      const a = await operator(true),
        saved = await channel(),
        operationKey = key();
      const path = `${work}/operations/claim/${operationKey}`;
      const { "X-CSRF-Token": _csrf, ...headers } = a.headers;
      expect(
        (await request(app).delete(path).set(headers).send({ target: saved.target }))
          .status,
      ).toBe(403);
      const cancelled = await request(app)
        .delete(path)
        .set(a.headers)
        .send({ target: saved.target });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data).toMatchObject({ state: "CANCELLED", channel: null });
      expect(
        (await act(saved.id, a, { action: "claim", expectedVersion: 1 }, operationKey))
          .status,
      ).toBe(409);
      const recovered = await request(app).get(path).set(a.headers);
      expect(recovered.status).toBe(200);
      expect(recovered.body.data.state).toBe("CANCELLED");
      const row = await prisma.supportConversation.findUniqueOrThrow({
        where: { id: saved.id },
      });
      expect(row.state).toBe("QUEUED");
      expect(row.version).toBe(1);
      expect(
        await prisma.supportMessage.count({ where: { enquiryId: saved.target.id } }),
      ).toBe(1);
    });
    it("preserves an already-saved claim when cancellation arrives after its acknowledgement was lost", async () => {
      const a = await operator(true),
        saved = await channel(),
        operationKey = key();
      expect(
        (await act(saved.id, a, { action: "claim", expectedVersion: 1 }, operationKey))
          .status,
      ).toBe(200);
      const result = await request(app)
        .delete(`${work}/operations/claim/${operationKey}`)
        .set(a.headers)
        .send({ target: saved.target });
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        state: "SAVED",
        channel: { id: saved.id, state: "HUMAN_ACTIVE", version: 2 },
      });
      expect(
        await prisma.supportMessage.count({ where: { enquiryId: saved.target.id } }),
      ).toBe(2);
      const another = await channel();
      expect(
        (
          await request(app)
            .delete(`${work}/operations/claim/${operationKey}`)
            .set(a.headers)
            .send({ target: another.target })
        ).status,
      ).toBe(409);
    });
    it("serializes a queued request against cancellation without creating a duplicate or deleting a saved channel", async () => {
      const original = await prisma.enquiry.create({
        data: {
          branchId: branch.id,
          customerId: customer.user.profile!.id,
          type: "GENERAL",
          name: "Synthetic",
          email: customer.user.email,
          subject: "Synthetic cancel race",
          message: "Synthetic original",
        },
      });
      const target = { kind: "ENQUIRY", id: original.id },
        operationKey = key();
      const [submitted, cancelled] = await Promise.all([
        request(app)
          .post(own)
          .set(customer.headers)
          .set("Idempotency-Key", operationKey)
          .send({ target, expectedCaseVersion: 0, expectedChannelVersion: 0 }),
        request(app)
          .delete(`${own}/operations/request/${operationKey}`)
          .set(customer.headers)
          .send({ target }),
      ]);
      expect(cancelled.status).toBe(200);
      if (cancelled.body.data.state === "SAVED") {
        expect(submitted.status).toBe(201);
        expect(
          await prisma.supportConversation.count({ where: { enquiryId: original.id } }),
        ).toBe(1);
      } else {
        expect(cancelled.body.data.state).toBe("CANCELLED");
        expect(submitted.status).toBe(409);
        expect(
          await prisma.supportConversation.count({ where: { enquiryId: original.id } }),
        ).toBe(0);
      }
      expect(
        (await prisma.enquiry.findUniqueOrThrow({ where: { id: original.id } })).status,
      ).toBe("OPEN");
    });
    it("requeues active channels when live mode is disabled without ending the business case", async () => {
      const a = await operator(true),
        saved = await channel();
      await act(saved.id, a, { action: "claim", expectedVersion: 1 });
      env.SUPPORT_LIVE_CHAT_ENABLED = false;
      await prisma.workerScanCheckpoint.update({
        where: { name: "support-channel-reconcile:v1" },
        data: { afterCreatedAt: null, afterId: null },
      });
      const maximum = await prisma.supportConversation.count({
        where: { state: { not: "ENDED" } },
      });
      for (let i = 0; i <= maximum; i += 10) await new SupportChannelWorker().runOnce(10);
      expect(
        (await prisma.supportConversation.findUniqueOrThrow({ where: { id: saved.id } }))
          .state,
      ).toBe("QUEUED");
      expect(
        (await prisma.enquiry.findUniqueOrThrow({ where: { id: saved.target.id } }))
          .status,
      ).toBe("OPEN");
    });
  },
);
