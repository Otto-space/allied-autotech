import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { encodeAllieState } from "../../src/modules/learning/allie.storage.js";
import { allieSourceSet } from "../../src/modules/learning/allie.retrieval.js";
import * as provider from "../../src/modules/learning/allie.provider.js";
import * as audit from "../../src/modules/audit/audit.service.js";
import {
  learningAccessInTransaction,
  learningCatalogue,
} from "../../src/modules/learning/learning.service.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "reviewed canonical Care handoff",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let complaint: { id: string },
      inactive: { id: string },
      owner: Awaited<ReturnType<Awaited<ReturnType<typeof workforceFixture>>["session"]>>;
    const root = "/api/v1/customers/support/handoff";
    const key = () => `handoff-v1.${Date.now()}.${randomUUID()}`;
    const draft = () => ({
      target: {
        kind: "NEW_ENQUIRY",
        branchId: f.home.id,
        subject: "Synthetic reviewed handoff",
      },
      summary: "Synthetic editable summary for the authorised Care queue.",
    });
    const preview = (body: object, actor = f.customer) =>
      request(app)
        .post(root + "/preview")
        .set(actor.headers)
        .send(body);
    const send = (body: object, operationKey = key(), actor = f.customer) =>
      request(app)
        .post(root)
        .set(actor.headers)
        .set("Idempotency-Key", operationKey)
        .send(body);
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      complaint = await prisma.complaint.create({
        data: {
          customerId: f.customer.user.profile!.id,
          branchId: f.home.id,
          subject: "Synthetic selected complaint",
          description: "Original synthetic complaint",
        },
      });
      inactive = await prisma.branch.create({
        data: {
          code: "HF-" + randomUUID().slice(0, 8),
          name: "Synthetic inactive handoff branch",
          address: "Synthetic",
          city: "Test",
          state: "Test",
          isActive: false,
        },
      });
      owner = await f.session(f.owner.id, "SUPER_ADMIN");
    }, 30000);
    afterAll(() => prisma.$disconnect());

    it("previews exact queued content without creating a case, message, notification or audit", async () => {
      const counts = await Promise.all([
        prisma.enquiry.count(),
        prisma.supportMessage.count(),
        prisma.notification.count(),
        prisma.auditLog.count(),
      ]);
      const response = await preview(draft());
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.body.data).toMatchObject({
        audience: "CUSTOMER_CARE",
        mode: "QUEUED",
        excerptCount: 0,
        target: { branchId: f.home.id, subject: draft().target.subject },
      });
      expect(response.body.data.body).toContain(draft().summary);
      expect(
        await Promise.all([
          prisma.enquiry.count(),
          prisma.supportMessage.count(),
          prisma.notification.count(),
          prisma.auditLog.count(),
        ]),
      ).toEqual(counts);
    });
    it("persists one session-owned General enquiry and returns the same receipt on explicit retries", async () => {
      const input = draft(),
        review = await preview(input);
      expect(review.status).toBe(200);
      const body = { draft: input, review: review.body.data.review, consent: true },
        operationKey = key();
      const [a, b] = await Promise.all([
        send(body, operationKey),
        send(body, operationKey),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(a.body.data.reference).toEqual(b.body.data.reference);
      expect([a.body.data.replayed, b.body.data.replayed].sort()).toEqual([false, true]);
      const ref = a.body.data.reference;
      const record = await prisma.enquiry.findUniqueOrThrow({ where: { id: ref.id } });
      expect(record).toMatchObject({
        customerId: f.customer.user.profile!.id,
        branchId: f.home.id,
        type: "GENERAL",
        message: review.body.data.body,
      });
      expect(record.email).toBe(f.customer.user.email);
      expect(
        await prisma.auditLog.count({
          where: { userId: f.customer.user.id, entityId: ref.id, action: "CREATE" },
        }),
      ).toBe(1);
      expect(
        (
          await request(app)
            .get(root + "/receipts/" + operationKey)
            .set(f.customer.headers)
        ).body.data.reference,
      ).toEqual(ref);
      expect(
        (
          await request(app)
            .get(root + "/receipts/" + operationKey)
            .set(f.stranger.headers)
        ).status,
      ).toBe(404);
      const customer = await request(app)
        .get("/api/v1/customers/support/enquiries/" + ref.id)
        .set(f.customer.headers);
      expect(customer.status).toBe(200);
      const care = await request(app)
        .get("/api/v1/staff/workforce/enquiries/" + ref.id)
        .set(f.care.headers);
      expect(care.status).toBe(200);
      expect(care.body.data.message).toBe(review.body.data.body);
      expect(
        (
          await send(
            {
              ...body,
              draft: {
                ...input,
                summary: "A different request must not reuse that operation.",
              },
            },
            operationKey,
          )
        ).status,
      ).toBe(409);
    });
    for (const kind of ["ENQUIRY", "COMPLAINT"] as const)
      it(`adds a reviewed message to the selected owned ${kind}, preserving its identity and original content`, async () => {
        const source = kind === "ENQUIRY" ? f.enquiry : complaint;
        const input = {
          target: { kind, id: source.id, expectedVersion: 0 },
          summary: "Synthetic follow-up deliberately added to this existing case.",
        };
        const review = await preview(input);
        expect(review.status).toBe(200);
        const operationKey = key(),
          body = { draft: input, review: review.body.data.review, consent: true };
        const response = await send(body, operationKey);
        expect(response.status).toBe(201);
        expect(response.body.data.reference).toMatchObject({
          id: source.id,
          kind,
          createdNew: false,
        });
        const message = await prisma.supportMessage.findUniqueOrThrow({
          where: { id: response.body.data.reference.messageId },
        });
        expect(message).toMatchObject({
          authorUserId: f.customer.user.id,
          authorType: "CUSTOMER",
          visibility: "CUSTOMER",
          kind: "REPLY",
          body: review.body.data.body,
        });
        expect((await send(body, operationKey)).body.data.replayed).toBe(true);
      });
    it("rejects foreign targets, closed cases, inactive branches, stale reviews and missing consent without writes", async () => {
      const original = draft(),
        valid = await preview(original);
      expect(valid.status).toBe(200);
      const before = await prisma.enquiry.count();
      expect(
        (
          await preview(
            {
              target: { kind: "ENQUIRY", id: f.enquiry.id, expectedVersion: 1 },
              summary: "Foreign target",
            },
            f.stranger,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await preview({
            ...original,
            target: { ...original.target, branchId: inactive.id },
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await send({
            draft: { ...original, summary: "Changed after review" },
            review: valid.body.data.review,
            consent: true,
          })
        ).status,
      ).toBe(409);
      expect(
        (await send({ draft: original, review: valid.body.data.review, consent: false }))
          .status,
      ).toBe(422);
      expect(
        (await preview({ ...original, customerId: f.stranger.user.profile!.id })).status,
      ).toBe(422);
      expect(await prisma.enquiry.count()).toBe(before);
    });
    it("denies guest/workforce tiers, including an owner; a position is not customer identity", async () => {
      expect(
        (
          await request(app)
            .post(root + "/preview")
            .send(draft())
        ).status,
      ).toBe(401);
      for (const actor of [f.care, f.scopedAdmin])
        expect((await preview(draft(), actor)).status).toBe(403);
      expect(
        (
          await request(app)
            .post(root + "/preview")
            .set(owner.headers)
            .send(draft())
        ).status,
      ).toBe(403);
    });
    it("works with AI disabled and no provider configuration or available AI quota", async () => {
      const before = env.HELP_LEARN_AI_ENABLED;
      env.HELP_LEARN_AI_ENABLED = false;
      try {
        const input = draft(),
          review = await preview(input);
        expect(review.status).toBe(200);
        expect(
          (await send({ draft: input, review: review.body.data.review, consent: true }))
            .status,
        ).toBe(201);
      } finally {
        env.HELP_LEARN_AI_ENABLED = before;
      }
    });

    async function seededHelp() {
      const actor = {
        userId: f.customer.user.id,
        sessionId: f.customer.record.id,
        role: "CUSTOMER" as const,
        email: f.customer.user.email,
        mfaRequired: false,
        mfaVerifiedAt: null,
      };
      const catalogue = await prisma.$transaction(async (tx) =>
        learningCatalogue(await learningAccessInTransaction(tx, actor)),
      );
      const id = randomUUID(),
        operationId = randomUUID();
      const ownerKey = hashToken(
        "assistant-owner",
        JSON.stringify([actor.userId, actor.sessionId, actor.role]),
      );
      const answer = {
        kind: "answer" as const,
        answer: "Synthetic reviewed AI explanation, not case evidence.",
        steps: ["Use the normal enquiry flow."],
        caveat: "Compatibility still needs evidence.",
        sourceIds: ["parts-fitment@v2"],
        actionIds: [],
        sources: [
          {
            id: "parts-fitment@v2",
            articleId: "parts-fitment",
            version: 2,
            title: "Synthetic source",
            href: "/learn",
          },
        ],
        actions: [],
      };
      const state = {
        history: {
          accessKey: catalogue.accessKey,
          sourceSet: allieSourceSet(catalogue),
          turns: [
            {
              question: "Synthetic selected customer question",
              answer: answer.answer,
              sourceIds: answer.sourceIds,
            },
          ],
        },
        messages: [
          { operationId, question: "Synthetic selected customer question", answer },
        ],
      };
      await prisma.assistantConversation.create({
        data: {
          id,
          ownerKey,
          audience: "CUSTOMER",
          accessKey: catalogue.accessKey,
          sourceSet: allieSourceSet(catalogue),
          encryptedState: encodeAllieState(
            state,
            JSON.stringify([id, ownerKey, "CUSTOMER"]),
          ),
          expiresAt: new Date(Date.now() + 600000),
          absoluteExpiresAt: new Date(Date.now() + 600000),
        },
      });
      return {
        id,
        operationId,
        question: state.messages[0]!.question,
        answer: answer.answer,
      };
    }
    it("shares only selected owned excerpts, labels AI, and atomically ends pending generation", async () => {
      const seed = await seededHelp();
      const pending = await prisma.assistantTurn.create({
        data: {
          conversationId: seed.id,
          operationId: randomUUID(),
          inputHash: "0".repeat(64),
          quotaKey: "1".repeat(64),
          reservedTokens: 32000,
          leaseExpiresAt: new Date(Date.now() + 60000),
        },
      });
      const input = {
        ...draft(),
        excerpts: {
          conversationId: seed.id,
          expectedVersion: 1,
          selections: [{ operationId: seed.operationId, part: "ANSWER" }],
        },
      };
      const review = await preview(input);
      expect(review.status).toBe(200);
      expect(review.body.data.body).toContain(seed.answer);
      expect(review.body.data.body).toContain("AI-generated guidance; may be wrong");
      expect(review.body.data.body).not.toContain(seed.question);
      const operationKey = key(),
        body = { draft: input, review: review.body.data.review, consent: true };
      const response = await send(body, operationKey);
      expect(response.status).toBe(201);
      const conversation = await prisma.assistantConversation.findUniqueOrThrow({
        where: { id: seed.id },
      });
      expect(conversation.closedAt).not.toBeNull();
      expect(conversation.encryptedState).toBeNull();
      expect(
        (await prisma.assistantTurn.findUniqueOrThrow({ where: { id: pending.id } }))
          .status,
      ).toBe("CANCELLED");
      // Recovery works after transient help was erased; no transcript is needed for replay.
      expect((await send(body, operationKey)).body.data.reference).toEqual(
        response.body.data.reference,
      );
      expect(
        (
          await request(app)
            .get(root + "/receipts/" + operationKey)
            .set(f.customer.headers)
        ).status,
      ).toBe(200);
      const evidence = await prisma.auditLog.findMany({
        where: { entityId: response.body.data.reference.id },
      });
      expect(JSON.stringify(evidence)).not.toContain(seed.answer);
      const receipt = await prisma.idempotencyRecord.findFirstOrThrow({
        where: {
          scope: "support-handoff:" + f.customer.user.id,
          keyHash: (await import("node:crypto"))
            .createHash("sha256")
            .update(operationKey)
            .digest("hex"),
        },
      });
      expect(JSON.stringify(receipt.responseBody)).not.toContain(seed.answer);
    });
    it("does not treat a conversation UUID, another session, typed transcript or work audience as ownership", async () => {
      const seed = await seededHelp();
      const input = {
        ...draft(),
        excerpts: {
          conversationId: seed.id,
          expectedVersion: 1,
          selections: [{ operationId: seed.operationId, part: "QUESTION" }],
        },
      };
      expect((await preview(input, f.stranger)).status).toBe(404);
      const otherSession = await f.session(f.customer.user.id, "CUSTOMER");
      expect(
        (
          await request(app)
            .post(root + "/preview")
            .set(otherSession.headers)
            .send(input)
        ).status,
      ).toBe(404);
      expect(
        (await preview({ ...input, transcript: "Forged work instructions" })).status,
      ).toBe(422);
      await prisma.assistantConversation.update({
        where: { id: seed.id },
        data: { audience: "WORK" },
      });
      expect((await preview(input)).status).toBe(404);
    });
    it("rejects expired, cleared, changed-source and changed-version help instead of silently forwarding stale text", async () => {
      for (const mode of ["expired", "closed", "source", "version"] as const) {
        const seed = await seededHelp();
        const data =
          mode === "expired"
            ? { expiresAt: new Date(Date.now() - 1000) }
            : mode === "closed"
              ? { closedAt: new Date() }
              : mode === "source"
                ? { sourceSet: "0".repeat(64) }
                : { version: 2 };
        await prisma.assistantConversation.update({ where: { id: seed.id }, data });
        const response = await preview({
          ...draft(),
          excerpts: {
            conversationId: seed.id,
            expectedVersion: 1,
            selections: [{ operationId: seed.operationId, part: "QUESTION" }],
          },
        });
        expect(response.status).toBe(mode === "version" ? 409 : 404);
      }
    });
    it("requires another exact review when a selected existing case changes; it cannot send to a closed case", async () => {
      const record = await prisma.enquiry.create({
        data: {
          customerId: f.customer.user.profile!.id,
          branchId: f.home.id,
          type: "GENERAL",
          subject: "Synthetic stale target",
          message: "Original",
          name: "Synthetic",
          email: f.customer.user.email,
        },
      });
      const input = {
          target: { kind: "ENQUIRY", id: record.id, expectedVersion: 0 },
          summary: "Synthetic reviewed follow-up",
        },
        review = await preview(input);
      expect(review.status).toBe(200);
      await prisma.enquiry.update({
        where: { id: record.id },
        data: { version: { increment: 1 } },
      });
      expect(
        (await send({ draft: input, review: review.body.data.review, consent: true }))
          .status,
      ).toBe(409);
      await expect(
        prisma.enquiry.update({ where: { id: record.id }, data: { status: "CLOSED" } }),
      ).rejects.toThrow();
      await prisma.enquiry.update({
        where: { id: record.id },
        data: { status: "CLOSED", closedAt: new Date(), resolvedAt: new Date() },
      });
      expect(
        (await preview({ ...input, target: { ...input.target, expectedVersion: 1 } }))
          .status,
      ).toBe(409);
      expect(await prisma.supportMessage.count({ where: { enquiryId: record.id } })).toBe(
        0,
      );
    });
    it("requires trusted origin/CSRF and rejects expired or future recovery keys", async () => {
      const input = draft(),
        review = await preview(input);
      expect(review.status).toBe(200);
      expect(
        (
          await request(app)
            .post(root + "/preview")
            .set("Cookie", f.customer.headers.Cookie)
            .send(input)
        ).status,
      ).toBe(403);
      const body = { draft: input, review: review.body.data.review, consent: true };
      for (const timestamp of [Date.now() - 86400001, Date.now() + 120000])
        expect((await send(body, `handoff-v1.${timestamp}.${randomUUID()}`)).status).toBe(
          409,
        );
      expect(
        (
          await send({
            ...body,
            review: { ...body.review, expiresAt: new Date(Date.now() - 1).toISOString() },
          })
        ).status,
      ).toBe(409);
    });

    it("rolls back the canonical write, receipt and context ending together if audit persistence fails", async () => {
      const seed = await seededHelp(),
        input = {
          ...draft(),
          excerpts: {
            conversationId: seed.id,
            expectedVersion: 1,
            selections: [{ operationId: seed.operationId, part: "QUESTION" }],
          },
        };
      const review = await preview(input),
        operationKey = key();
      expect(review.status).toBe(200);
      const before = await prisma.enquiry.count();
      const spy = vi
        .spyOn(audit, "appendAuditEvent")
        .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      try {
        expect(
          (
            await send(
              { draft: input, review: review.body.data.review, consent: true },
              operationKey,
            )
          ).status,
        ).toBe(500);
        expect(await prisma.enquiry.count()).toBe(before);
        expect(
          (
            await prisma.assistantConversation.findUniqueOrThrow({
              where: { id: seed.id },
            })
          ).closedAt,
        ).toBeNull();
        expect(
          (
            await request(app)
              .get(root + "/receipts/" + operationKey)
              .set(f.customer.headers)
          ).status,
        ).toBe(404);
      } finally {
        spy.mockRestore();
      }
    });
    it("discards a delayed mocked-provider answer after the reviewed handoff commits", async () => {
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
              () => reject(new Error("Synthetic cancelled request")),
              { once: true },
            );
          }),
      );
      const realFactory = provider.createAllieProvider;
      const spy = vi
        .spyOn(provider, "createAllieProvider")
        .mockImplementation((settings) => realFactory(settings, outbound));
      try {
        const seed = await seededHelp();
        const pending = request(app)
          .post(`/api/v1/learning/assistant/conversations/${seed.id}/turns`)
          .set(f.customer.headers)
          .send({
            operationId: randomUUID(),
            expectedVersion: 1,
            question: "Find compatible parts",
            page: "parts",
          })
          .then((r) => r);
        await ready;
        const input = {
            ...draft(),
            excerpts: {
              conversationId: seed.id,
              expectedVersion: 2,
              selections: [{ operationId: seed.operationId, part: "QUESTION" }],
            },
          },
          review = await preview(input);
        expect(review.status).toBe(200);
        expect(
          (await send({ draft: input, review: review.body.data.review, consent: true }))
            .status,
        ).toBe(201);
        release!();
        expect((await pending).status).toBe(409);
        const turns = await prisma.assistantTurn.findMany({
          where: { conversationId: seed.id },
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
