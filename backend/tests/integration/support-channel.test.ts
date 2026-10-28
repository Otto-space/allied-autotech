import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as provider from "../../src/modules/learning/allie.provider.js";
import * as audit from "../../src/modules/audit/audit.service.js";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "canonical human channel lifecycle",
  () => {
    let app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    const previousFlag = env.SUPPORT_LIVE_CHAT_ENABLED;
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let customer: Awaited<ReturnType<typeof workforceFixture>>["customer"];
    const root = "/api/v1/customers/support/live/channels";
    const work = "/api/v1/staff/workforce/support-chat/channels";
    const key = () => `support-reply-v1.${Date.now()}.${randomUUID()}`;
    type Session = { headers: Record<string, string> };
    type Target = { kind: "ENQUIRY" | "COMPLAINT"; id: string };
    async function target(kind: Target["kind"] = "ENQUIRY", branchId?: string) {
      const data = {
        customerId: customer.user.profile!.id,
        branchId: branchId ?? f.home.id,
        subject: `Synthetic human channel ${randomUUID()}`,
      };
      const row =
        kind === "ENQUIRY"
          ? await prisma.enquiry.create({
              data: {
                ...data,
                type: "GENERAL",
                name: "Synthetic customer",
                email: customer.user.email,
                message: "Original synthetic question",
                assignedStaffId: f.care.user.staffProfile!.id,
              },
            })
          : await prisma.complaint.create({
              data: { ...data, description: "Original synthetic complaint" },
            });
      return { kind, id: row.id };
    }
    const start = (t: Target, body: object = {}, operationKey = key(), actor?: Session) =>
      request(app)
        .post(root)
        .set((actor ?? customer).headers)
        .set("Idempotency-Key", operationKey)
        .send({ target: t, expectedCaseVersion: 0, expectedChannelVersion: 0, ...body });
    const get = (id: string, actor?: Session) =>
      request(app)
        .get((actor ? work : root) + "/" + id)
        .set((actor ?? customer).headers);
    const action = (
      id: string,
      actor: Session,
      body: object,
      operationKey = key(),
      customer = false,
    ) =>
      request(app)
        .post((customer ? root : work) + "/" + id + "/actions")
        .set(actor.headers)
        .set("Idempotency-Key", operationKey)
        .send(body);
    async function agent(assigner = false) {
      const a = await f.account("CARE_VIEWER");
      await f.assignment(a.user.id, "CARE_RESPONDER");
      await f.assignment(a.user.id, "CARE_LIVE_AGENT");
      if (assigner) await f.assignment(a.user.id, "CARE_ASSIGNER");
      const opted = await request(app)
        .put("/api/v1/staff/workforce/support-chat/presence")
        .set(a.headers)
        .send({ expectedVersion: 0, branchId: f.home.id, available: true, capacity: 1 });
      expect(opted.status).toBe(200);
      return a;
    }
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      await prisma.supportLiveCoverage.create({
        data: {
          branchId: f.home.id,
          enabled: true,
          schedule: {
            timezone: "Africa/Lagos",
            windows: Array.from({ length: 7 }, (_, day) => ({
              day,
              startMinute: 0,
              endMinute: 1440,
            })),
          },
          maxConcurrentPerAgent: 1,
          updatedByUserId: f.owner.id,
        },
      });
    }, 60000);
    beforeEach(async () => {
      app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      env.SUPPORT_LIVE_CHAT_ENABLED = true;
      customer = await f.account(null, "CUSTOMER");
    });
    afterAll(async () => {
      env.SUPPORT_LIVE_CHAT_ENABLED = previousFlag;
      await prisma.$disconnect();
    });

    it.each(["ENQUIRY", "COMPLAINT"] as const)(
      "requests and replays one owned %s channel without replacing the case",
      async (kind) => {
        const t = await target(kind),
          operationKey = key();
        const [first, repeat] = await Promise.all([
          start(t, {}, operationKey),
          start(t, {}, operationKey),
        ]);
        expect([first.status, repeat.status]).toEqual([201, 201]);
        expect(first.body.data.id).toBe(repeat.body.data.id);
        expect([first.body.data.replayed, repeat.body.data.replayed].sort()).toEqual([
          false,
          true,
        ]);
        expect(
          await prisma.supportMessage.count({
            where: kind === "ENQUIRY" ? { enquiryId: t.id } : { complaintId: t.id },
          }),
        ).toBe(1);
        expect((await start(t, { expectedCaseVersion: 1 }, operationKey)).status).toBe(
          409,
        );
        expect((await start(t, {}, key(), f.stranger)).status).toBe(404);
      },
    );
    it("keeps requests queued while live mode is disabled and denies claims", async () => {
      const a = await agent();
      env.SUPPORT_LIVE_CHAT_ENABLED = false;
      const saved = await start(await target());
      expect(saved.status).toBe(201);
      expect(saved.body.data.state).toBe("QUEUED");
      expect(
        (await action(saved.body.data.id, a, { action: "claim", expectedVersion: 1 }))
          .status,
      ).toBe(503);
    });
    it("hides another customer's channel, private case notes and internal staff identifiers", async () => {
      const t = await target(),
        saved = await start(t),
        id = saved.body.data.id;
      await prisma.supportMessage.create({
        data: {
          enquiryId: t.id,
          authorType: "STAFF",
          kind: "INTERNAL_NOTE",
          visibility: "INTERNAL",
          body: "INTERNAL-SYNTHETIC-NEVER-SHARE",
          authorUserId: f.owner.id,
        },
      });
      const reply = await get(id);
      expect(reply.status).toBe(200);
      expect(JSON.stringify(reply.body)).not.toMatch(
        /INTERNAL-SYNTHETIC|assignedUserId|sessionId|email/,
      );
      expect(
        (
          await request(app)
            .get(root + "/" + id)
            .set(f.stranger.headers)
        ).status,
      ).toBe(404);
      const other = await f.account("CARE_VIEWER", "STAFF", f.other.id);
      expect((await get(id, other)).status).toBe(404);
      const publicHistory = await request(app)
        .get(`/api/v1/customers/support/enquiries/${t.id}/messages`)
        .set(customer.headers);
      expect(publicHistory.status).toBe(200);
      expect(JSON.stringify(publicHistory.body)).not.toContain("INTERNAL-SYNTHETIC");
    });
    it("serializes two agents claiming one channel and safely replays the winning claim", async () => {
      const a = await agent(),
        b = await agent(),
        t = await target(),
        saved = await start(t),
        id = saved.body.data.id;
      const keys = [key(), key()];
      const replies = await Promise.all([
        action(id, a, { action: "claim", expectedVersion: 1 }, keys[0]),
        action(id, b, { action: "claim", expectedVersion: 1 }, keys[1]),
      ]);
      expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
      const winner = replies[0]!.status === 200 ? 0 : 1;
      const replay = await action(
        id,
        [a, b][winner]!,
        { action: "claim", expectedVersion: 1 },
        keys[winner],
      );
      expect(replay.status).toBe(200);
      expect(replay.body.data).toMatchObject({
        replayed: true,
        state: "HUMAN_ACTIVE",
        version: 2,
      });
      const row = await prisma.enquiry.findUniqueOrThrow({ where: { id: t.id } });
      expect(row.assignedStaffId).toBe(f.care.user.staffProfile!.id);
      expect(await prisma.supportMessage.count({ where: { enquiryId: t.id } })).toBe(2);
    });
    it("enforces one shared agent seat across concurrent claims of separate cases", async () => {
      const a = await agent(),
        one = await start(await target()),
        two = await start(await target());
      const replies = await Promise.all(
        [one, two].map((r) =>
          action(r.body.data.id, a, { action: "claim", expectedVersion: 1 }),
        ),
      );
      expect(replies.map((r) => r.status).sort()).toEqual([200, 503]);
      expect(
        await prisma.supportConversation.count({
          where: { assignedUserId: a.user.id, state: "HUMAN_ACTIVE" },
        }),
      ).toBe(1);
    });
    it("requires separate assignment authority and current target availability for transfer", async () => {
      const a = await agent(true),
        b = await agent(),
        saved = await start(await target()),
        id = saved.body.data.id;
      expect((await action(id, a, { action: "claim", expectedVersion: 1 })).status).toBe(
        200,
      );
      const transfer = {
        action: "transfer",
        expectedVersion: 2,
        targetStaffId: b.user.staffProfile!.id,
        reason: "INTERNAL-SYNTHETIC-TRANSFER-REASON",
      };
      expect((await action(id, b, transfer)).status).toBe(403);
      const moved = await action(id, a, transfer);
      expect(moved.status).toBe(200);
      expect(moved.body.data.state).toBe("HUMAN_ACTIVE");
      expect((await get(id, b)).body.data.assignedToYou).toBe(true);
      expect(JSON.stringify((await get(id)).body)).not.toContain(transfer.reason);
      const history = await prisma.supportMessage.findMany({
        where: { enquiryId: saved.body.data.target.id },
      });
      expect(history.some((m) => m.body.includes(transfer.reason))).toBe(false);
    });
    it("rejects an ineligible branch transfer and preserves the current agent", async () => {
      const a = await agent(true),
        wrong = await f.account("CARE_VIEWER", "STAFF", f.other.id),
        saved = await start(await target());
      await action(saved.body.data.id, a, { action: "claim", expectedVersion: 1 });
      expect(
        (
          await action(saved.body.data.id, a, {
            action: "transfer",
            expectedVersion: 2,
            targetStaffId: wrong.user.staffProfile!.id,
            reason: "Synthetic invalid transfer",
          })
        ).status,
      ).toBe(409);
      expect((await get(saved.body.data.id, a)).body.data.assignedToYou).toBe(true);
    });
    it.each(["lease", "revoked-session", "revoked-duty", "withdrawn"])(
      "requeues once after %s without losing canonical history",
      async (reason) => {
        const a = await agent(),
          saved = await start(await target()),
          id = saved.body.data.id;
        await action(id, a, { action: "claim", expectedVersion: 1 });
        if (reason === "lease")
          await prisma.supportLivePresence.update({
            where: { userId: a.user.id },
            data: { expiresAt: new Date(Date.now() - 1) },
          });
        if (reason === "revoked-session")
          await prisma.session.update({
            where: { id: a.record.id },
            data: { revokedAt: new Date() },
          });
        if (reason === "revoked-duty")
          await prisma.workforceAssignment.updateMany({
            where: { userId: a.user.id, template: "CARE_LIVE_AGENT" },
            data: { revokedAt: new Date() },
          });
        if (reason === "withdrawn")
          await prisma.supportLivePresence.update({
            where: { userId: a.user.id },
            data: { available: false },
          });
        const reply = await get(id);
        expect(reply.status).toBe(200);
        expect(reply.body.data).toMatchObject({
          state: "QUEUED",
          version: 3,
          assignedToYou: false,
        });
        expect((await get(id)).body.data.version).toBe(3);
        expect(
          await prisma.supportMessage.count({
            where: { enquiryId: saved.body.data.target.id },
          }),
        ).toBe(3);
        if (reason === "revoked-duty")
          expect(
            (await action(id, a, { action: "claim", expectedVersion: 3 })).status,
          ).toBe(403);
      },
    );
    it("ends and replays an agent's own channel while preserving ordinary case status", async () => {
      const a = await agent(),
        saved = await start(await target()),
        id = saved.body.data.id;
      await action(id, a, { action: "claim", expectedVersion: 1 });
      const operationKey = key(),
        payload = { action: "end", expectedVersion: 2 };
      const ended = await action(id, a, payload, operationKey);
      expect(ended.status).toBe(200);
      expect(ended.body.data.state).toBe("ENDED");
      const replay = await action(id, a, payload, operationKey);
      expect(replay.status).toBe(200);
      expect(replay.body.data.replayed).toBe(true);
      expect(
        (
          await prisma.enquiry.findUniqueOrThrow({
            where: { id: saved.body.data.target.id },
          })
        ).status,
      ).toBe("OPEN");
    });
    it("lets only the owning customer end their queued channel and preserves a separate new request", async () => {
      const saved = await start(await target()),
        id = saved.body.data.id;
      expect(
        (await action(id, f.stranger, { action: "end", expectedVersion: 1 }, key(), true))
          .status,
      ).toBe(404);
      expect(
        (await action(id, customer, { action: "end", expectedVersion: 1 }, key(), true))
          .status,
      ).toBe(200);
      const reopened = await start(saved.body.data.target, {
        expectedCaseVersion: 2,
        expectedChannelVersion: 2,
      });
      expect(reopened.status).toBe(201);
      expect(reopened.body.data).toMatchObject({ id, state: "QUEUED", version: 3 });
    });
    it("closes a queued channel when the canonical case closes", async () => {
      const saved = await start(await target()),
        id = saved.body.data.id;
      await prisma.enquiry.update({
        where: { id: saved.body.data.target.id },
        data: { status: "CLOSED", resolvedAt: new Date(), closedAt: new Date() },
      });
      expect((await get(id)).body.data.state).toBe("ENDED");
      expect((await get(id)).body.data.version).toBe(2);
    });
    it("requires CSRF and strict payloads and prevents a customer claiming a room", async () => {
      const t = await target();
      const { "X-CSRF-Token": _csrf, ...headers } = customer.headers;
      expect((await start(t, {}, key(), { headers })).status).toBe(403);
      expect((await start(t, { customerId: customer.user.profile!.id })).status).toBe(
        422,
      );
      const saved = await start(t);
      expect(
        (
          await action(
            saved.body.data.id,
            customer,
            { action: "claim", expectedVersion: 1 },
            key(),
            true,
          )
        ).status,
      ).toBe(403);
    });
    it("recovers a channel after reload through only its authorised canonical case", async () => {
      const t = await target(),
        path = root + `/by-case/${t.kind}/${t.id}`;
      const absent = await request(app).get(path).set(customer.headers);
      expect(absent.status).toBe(200);
      expect(absent.body.data).toEqual({
        channel: null,
        caseVersion: 0,
        latestPublicMessageId: null,
      });
      const saved = await start(t),
        recovered = await request(app).get(path).set(customer.headers);
      expect(recovered.status).toBe(200);
      expect(recovered.body.data).toMatchObject({
        channel: { id: saved.body.data.id, state: "QUEUED" },
        caseVersion: 1,
      });
      expect((await request(app).get(path).set(f.stranger.headers)).status).toBe(404);
    });
    it("binds action receipts to the exact channel and preserves a different queued request", async () => {
      const first = await start(await target()),
        second = await start(await target()),
        operationKey = key();
      expect(
        (
          await action(
            first.body.data.id,
            customer,
            { action: "end", expectedVersion: 1 },
            operationKey,
            true,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await action(
            second.body.data.id,
            customer,
            { action: "end", expectedVersion: 1 },
            operationKey,
            true,
          )
        ).status,
      ).toBe(409);
      expect((await get(second.body.data.id)).body.data.state).toBe("QUEUED");
    });
    it("never permits an unrelated live agent to end another representative's channel", async () => {
      const a = await agent(),
        b = await agent(),
        saved = await start(await target());
      await action(saved.body.data.id, a, { action: "claim", expectedVersion: 1 });
      expect(
        (await action(saved.body.data.id, b, { action: "end", expectedVersion: 2 }))
          .status,
      ).toBe(403);
      expect((await get(saved.body.data.id, a)).body.data.assignedToYou).toBe(true);
    });
    it("reports canClaim only with fresh opt-in, hours and capacity", async () => {
      const a = await agent(),
        first = await start(await target()),
        second = await start(await target());
      expect((await get(first.body.data.id, a)).body.data.canClaim).toBe(true);
      await action(first.body.data.id, a, { action: "claim", expectedVersion: 1 });
      expect((await get(second.body.data.id, a)).body.data.canClaim).toBe(false);
      await prisma.supportLivePresence.update({
        where: { userId: a.user.id },
        data: { available: false },
      });
      expect((await get(second.body.data.id, a)).body.data.canClaim).toBe(false);
      const original = await prisma.supportConversation.findUniqueOrThrow({
        where: { id: first.body.data.id },
      });
      expect(original.state).toBe("QUEUED");
    });
    it("closes only the explicitly selected owned AI context without forwarding it, even with AI off", async () => {
      const ownerKey = hashToken(
        "assistant-owner",
        JSON.stringify([customer.user.id, customer.record.id, "CUSTOMER"]),
      );
      const conversation = await prisma.assistantConversation.create({
        data: {
          ownerKey,
          audience: "CUSTOMER",
          accessKey: "a".repeat(64),
          sourceSet: "b".repeat(64),
          expiresAt: new Date(Date.now() + 600000),
          absoluteExpiresAt: new Date(Date.now() + 600000),
        },
      });
      const pending = await prisma.assistantTurn.create({
        data: {
          conversationId: conversation.id,
          operationId: randomUUID(),
          inputHash: "c".repeat(64),
          quotaKey: "d".repeat(64),
          reservedTokens: 1,
          leaseExpiresAt: new Date(Date.now() + 60000),
        },
      });
      const t = await target();
      expect(
        (
          await start(t, {
            assistantContext: { conversationId: conversation.id, expectedVersion: 1 },
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await prisma.assistantConversation.findUniqueOrThrow({
            where: { id: conversation.id },
          })
        ).closedAt,
      ).not.toBeNull();
      expect(
        (await prisma.assistantTurn.findUniqueOrThrow({ where: { id: pending.id } }))
          .status,
      ).toBe("CANCELLED");
      const otherCase = await target();
      const anotherSession = await f.session(customer.user.id, "CUSTOMER");
      expect(
        (
          await start(
            otherCase,
            { assistantContext: { conversationId: conversation.id, expectedVersion: 2 } },
            key(),
            anotherSession,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await start(
            otherCase,
            { assistantContext: { conversationId: conversation.id, expectedVersion: 2 } },
            key(),
            f.stranger,
          )
        ).status,
      ).toBe(404);
      expect(await prisma.supportMessage.count({ where: { enquiryId: t.id } })).toBe(1);
    });
    it("rolls back channel state, system history and AI closure together on audit failure", async () => {
      const ownerKey = hashToken(
        "assistant-owner",
        JSON.stringify([customer.user.id, customer.record.id, "CUSTOMER"]),
      );
      const conversation = await prisma.assistantConversation.create({
        data: {
          ownerKey,
          audience: "CUSTOMER",
          accessKey: "a".repeat(64),
          sourceSet: "b".repeat(64),
          expiresAt: new Date(Date.now() + 600000),
          absoluteExpiresAt: new Date(Date.now() + 600000),
        },
      });
      const t = await target(),
        spy = vi
          .spyOn(audit, "appendAuditEvent")
          .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      try {
        expect(
          (
            await start(t, {
              assistantContext: { conversationId: conversation.id, expectedVersion: 1 },
            })
          ).status,
        ).toBe(500);
        expect(
          await prisma.supportConversation.count({ where: { enquiryId: t.id } }),
        ).toBe(0);
        expect(await prisma.supportMessage.count({ where: { enquiryId: t.id } })).toBe(0);
        expect(
          (
            await prisma.assistantConversation.findUniqueOrThrow({
              where: { id: conversation.id },
            })
          ).closedAt,
        ).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });
    it("discards a delayed provider completion after a channel request closes the chosen AI context", async () => {
      const previous = {
        ai: env.HELP_LEARN_AI_ENABLED,
        key: env.OPENAI_API_KEY,
        model: env.ALLIE_OPENAI_MODEL,
        budget: env.ALLIE_AI_DAILY_TOKEN_LIMIT,
      };
      env.HELP_LEARN_AI_ENABLED = true;
      env.OPENAI_API_KEY = "synthetic-isolated-key-never-used-on-network";
      env.ALLIE_OPENAI_MODEL = "isolated-test-model";
      env.ALLIE_AI_DAILY_TOKEN_LIMIT = 10000000;
      let release: (() => void) | undefined, started: (() => void) | undefined;
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      const outbound = vi.fn<typeof fetch>(
        async (_url, init) =>
          new Promise<Response>((resolve, reject) => {
            release = () =>
              resolve(
                new Response(
                  JSON.stringify({
                    status: "completed",
                    model: "isolated-test-model",
                    output: [
                      {
                        type: "message",
                        role: "assistant",
                        status: "completed",
                        content: [
                          {
                            type: "output_text",
                            text: JSON.stringify({
                              kind: "answer",
                              answer: "A name match does not confirm compatibility.",
                              steps: ["Read the compatibility evidence."],
                              caveat: null,
                              sourceIds: ["parts-fitment@v2"],
                              actionIds: ["read:parts-fitment"],
                            }),
                          },
                        ],
                      },
                    ],
                    usage: { input_tokens: 120, output_tokens: 60, total_tokens: 180 },
                  }),
                  { headers: { "Content-Type": "application/json" } },
                ),
              );
            started!();
            init!.signal!.addEventListener(
              "abort",
              () => reject(new Error("Synthetic cancellation")),
              { once: true },
            );
          }),
      );
      const originalFactory = provider.createAllieProvider;
      const spy = vi
        .spyOn(provider, "createAllieProvider")
        .mockImplementation((settings) => originalFactory(settings, outbound));
      try {
        const opened = await request(app)
          .post("/api/v1/learning/assistant/conversations")
          .set(customer.headers)
          .send({ operationId: randomUUID() });
        expect(opened.status).toBe(200);
        const id = opened.body.data.conversation.id;
        const pending = request(app)
          .post(`/api/v1/learning/assistant/conversations/${id}/turns`)
          .set(customer.headers)
          .send({
            operationId: randomUUID(),
            expectedVersion: 1,
            question: "Find compatible parts",
            page: "parts",
          })
          .then((r) => r);
        await Promise.race([
          ready,
          pending.then(() => {
            throw new Error("Provider did not start");
          }),
        ]);
        expect(
          (
            await start(await target(), {
              assistantContext: { conversationId: id, expectedVersion: 2 },
            })
          ).status,
        ).toBe(201);
        release!();
        expect((await pending).status).toBe(409);
        const turns = await prisma.assistantTurn.findMany({
          where: { conversationId: id },
        });
        expect(turns).toHaveLength(1);
        expect(turns[0]!.status).toBe("CANCELLED");
        expect(turns[0]!.encryptedResult).toBeNull();
        expect(outbound).toHaveBeenCalledTimes(1);
      } finally {
        release?.();
        spy.mockRestore();
        env.HELP_LEARN_AI_ENABLED = previous.ai;
        env.OPENAI_API_KEY = previous.key;
        env.ALLIE_OPENAI_MODEL = previous.model;
        env.ALLIE_AI_DAILY_TOKEN_LIMIT = previous.budget;
      }
    });
  },
);
