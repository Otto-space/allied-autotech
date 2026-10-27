import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { decryptAssistantContext } from "../../src/common/security/mfa-encryption.js";
import * as provider from "../../src/modules/learning/allie.provider.js";
import { allieResponseSchemas } from "../../src/modules/learning/allie.schemas.js";
import { purgeExpiredAllieState } from "../../src/modules/learning/allie.retention.js";
import { encodeAllieState } from "../../src/modules/learning/allie.storage.js";
import {
  learningCatalogue,
  publicLearningAccess,
} from "../../src/modules/learning/learning.service.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "owned transient Allie conversations through actual HTTP",
  () => {
    const privatePath = "/api/v1/learning/assistant",
      publicPath = "/api/v1/public/learning/assistant";
    let app: ReturnType<typeof createApp>,
      f: Awaited<ReturnType<typeof workforceFixture>>;
    type Headers = Record<string, string>;
    const realFactory = provider.createAllieProvider;
    let factory: ReturnType<typeof vi.spyOn>, behavior: typeof fetch;
    const outbound = vi.fn<typeof fetch>((...args) => behavior(...args));
    const previous = {
      ai: env.HELP_LEARN_AI_ENABLED,
      learning: env.HELP_LEARN_ENABLED,
      key: env.OPENAI_API_KEY,
      model: env.ALLIE_OPENAI_MODEL,
      budget: env.ALLIE_AI_DAILY_TOKEN_LIMIT,
      concurrency: env.ALLIE_AI_GLOBAL_CONCURRENCY,
      mode: env.PUBLIC_LAUNCH_MODE,
    };
    const response = () =>
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
                    steps: ["Read the available compatibility evidence."],
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
      );
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      env.HELP_LEARN_ENABLED = true;
      env.HELP_LEARN_AI_ENABLED = true;
      env.OPENAI_API_KEY = "synthetic-key-never-used-on-network";
      env.ALLIE_OPENAI_MODEL = "isolated-test-model";
      env.ALLIE_AI_DAILY_TOKEN_LIMIT = 10000000;
      env.ALLIE_AI_GLOBAL_CONCURRENCY = 2;
      env.PUBLIC_LAUNCH_MODE = "browse_enquiries";
      factory = vi
        .spyOn(provider, "createAllieProvider")
        .mockImplementation((settings) => realFactory(settings, outbound));
      vi.stubGlobal("fetch", outbound);
      f = await workforceFixture();
      app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    }, 30000);
    beforeEach(() => {
      outbound.mockClear();
      behavior = async () => response();
    });
    afterAll(async () => {
      factory?.mockRestore();
      vi.unstubAllGlobals();
      env.HELP_LEARN_AI_ENABLED = previous.ai;
      env.HELP_LEARN_ENABLED = previous.learning;
      env.OPENAI_API_KEY = previous.key;
      env.ALLIE_OPENAI_MODEL = previous.model;
      env.ALLIE_AI_DAILY_TOKEN_LIMIT = previous.budget;
      env.ALLIE_AI_GLOBAL_CONCURRENCY = previous.concurrency;
      env.PUBLIC_LAUNCH_MODE = previous.mode;
      await prisma.$disconnect();
    });
    const create = (headers: Headers, path = privatePath, operationId = randomUUID()) =>
      request(app)
        .post(path + "/conversations")
        .set(headers)
        .send({ operationId });
    const read = (headers: Headers, id: string, path = privatePath) =>
      request(app)
        .get(path + "/conversations/" + id)
        .set(headers);
    const send = (headers: Headers, id: string, body: object, path = privatePath) =>
      request(app)
        .post(path + "/conversations/" + id + "/turns")
        .set(headers)
        .send(body);
    const turn = (version = 1, question = "Find compatible parts") => ({
      operationId: randomUUID(),
      expectedVersion: version,
      question,
      page: "parts",
    });
    async function guest() {
      const boot = await request(app)
        .post(publicPath + "/session")
        .set("Origin", "http://localhost:3000")
        .send({});
      expect(boot.status).toBe(200);
      allieResponseSchemas.session.parse(boot.body.data);
      const cookie = (boot.headers["set-cookie"] as unknown as string[])[0]!;
      expect(cookie.includes("HttpOnly")).toBe(true);
      expect(cookie.includes("SameSite=Lax")).toBe(true);
      expect(cookie.includes("Path=/")).toBe(true);
      return {
        Cookie: cookie.split(";")[0]!,
        Origin: "http://localhost:3000",
        "X-CSRF-Token": boot.body.data.csrfToken as string,
      };
    }
    function hold() {
      let release: (() => void) | undefined, started: (() => void) | undefined;
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      behavior = async (_url, init) =>
        new Promise<Response>((resolve, reject) => {
          release = () => resolve(response());
          started!();
          init!.signal!.addEventListener(
            "abort",
            () => reject(new Error("isolated aborted transport")),
            { once: true },
          );
        });
      return { ready, release: () => release!() };
    }
    it("stays disabled by default without creating assistant state or calling a model", async () => {
      const before = await prisma.assistantGuestSession.count();
      env.HELP_LEARN_AI_ENABLED = false;
      try {
        expect(
          (
            await request(app)
              .post(publicPath + "/session")
              .set("Origin", "http://localhost:3000")
              .send({})
          ).status,
        ).toBe(404);
        expect((await create(f.customer.headers)).status).toBe(404);
        expect(learningCatalogue(publicLearningAccess).flags.ai).toBe(false);
        expect(await prisma.assistantGuestSession.count()).toBe(before);
        expect(outbound).not.toHaveBeenCalled();
      } finally {
        env.HELP_LEARN_AI_ENABLED = true;
      }
    });
    it("advertises AI only with current help/provider/budget configuration and a release that permits conversation writes", () => {
      const configured = {
        key: env.OPENAI_API_KEY,
        model: env.ALLIE_OPENAI_MODEL,
        budget: env.ALLIE_AI_DAILY_TOKEN_LIMIT,
        mode: env.PUBLIC_LAUNCH_MODE,
      };
      try {
        expect(learningCatalogue(publicLearningAccess).flags.ai).toBe(true);
        env.PUBLIC_LAUNCH_MODE = "catalogue";
        expect(learningCatalogue(publicLearningAccess).flags.ai).toBe(false);
        env.PUBLIC_LAUNCH_MODE = "browse_enquiries";
        env.OPENAI_API_KEY = undefined;
        expect(learningCatalogue(publicLearningAccess).flags.ai).toBe(false);
        env.OPENAI_API_KEY = configured.key;
        env.ALLIE_OPENAI_MODEL = undefined;
        expect(learningCatalogue(publicLearningAccess).flags.ai).toBe(false);
        env.ALLIE_OPENAI_MODEL = configured.model;
        env.ALLIE_AI_DAILY_TOKEN_LIMIT = 0;
        expect(learningCatalogue(publicLearningAccess).flags.ai).toBe(false);
      } finally {
        env.OPENAI_API_KEY = configured.key;
        env.ALLIE_OPENAI_MODEL = configured.model;
        env.ALLIE_AI_DAILY_TOKEN_LIMIT = configured.budget;
        env.PUBLIC_LAUNCH_MODE = configured.mode;
      }
    });
    it("requires trusted origins and separate guest CSRF, then safely reuses the opaque guest session", async () => {
      expect(
        (
          await request(app)
            .post(publicPath + "/session")
            .send({})
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(publicPath + "/session")
            .set("Origin", "https://attacker.example")
            .send({})
        ).status,
      ).toBe(403);
      const headers = await guest();
      expect(
        (await create({ Cookie: headers.Cookie, Origin: headers.Origin }, publicPath))
          .status,
      ).toBe(403);
      expect(
        (await create({ ...headers, "X-CSRF-Token": "x".repeat(64) }, publicPath)).status,
      ).toBe(403);
      const again = await request(app)
        .post(publicPath + "/session")
        .set(headers)
        .send({});
      expect(again.status).toBe(200);
      expect(again.body.data.csrfToken === headers["X-CSRF-Token"]).toBe(true);
    });
    it("binds idempotent creation to the current owner and keeps guest/account histories separate", async () => {
      const headers = await guest(),
        operationId = randomUUID();
      const a = await create(headers, publicPath, operationId),
        b = await create(headers, publicPath, operationId);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(b.body.data.replayed).toBe(true);
      expect(b.body.data.conversation.id).toBe(a.body.data.conversation.id);
      const account = await create(f.customer.headers, privatePath, operationId);
      expect(account.status).toBe(200);
      expect(account.body.data.conversation.id).not.toBe(a.body.data.conversation.id);
      expect((await read(f.customer.headers, a.body.data.conversation.id)).status).toBe(
        404,
      );
      expect(
        (await read(headers, account.body.data.conversation.id, publicPath)).status,
      ).toBe(404);
      const businessCounts = () =>
        Promise.all([
          prisma.enquiry.count(),
          prisma.complaint.count(),
          prisma.supportMessage.count(),
          prisma.outboxEvent.count(),
          prisma.order.count(),
          prisma.payment.count(),
        ]);
      const before = await businessCounts();
      const generated = await send(
        headers,
        a.body.data.conversation.id,
        turn(),
        publicPath,
      );
      expect(generated.status).toBe(200);
      expect(generated.body.data.conversation.audience).toBe("public");
      expect(await businessCounts()).toEqual(before);
      expect(
        (
          await create(
            { ...headers, Cookie: headers.Cookie + "; " + f.customer.headers.Cookie },
            publicPath,
            randomUUID(),
          )
        ).body.data.conversation.audience,
      ).toBe("public");
    });
    it("preserves current managed-workforce access, MFA and strict input/CSRF rules", async () => {
      const weak = await f.session(f.care.user.id, "STAFF", false);
      expect((await create(weak.headers)).status).toBe(403);
      expect(
        (await create({ Cookie: f.care.headers.Cookie, Origin: "http://localhost:3000" }))
          .status,
      ).toBe(403);
      const created = await create(f.care.headers);
      expect(created.status).toBe(200);
      const id = created.body.data.conversation.id;
      expect(
        (
          await send(f.care.headers, id, {
            ...turn(),
            role: "SUPER_ADMIN",
            sourceIds: ["privileged-recovery@v2"],
          })
        ).status,
      ).toBe(422);
      expect((await send(f.care.headers, id, turn(1, "OTP: 123456"))).status).toBe(422);
      expect(
        (await send(f.care.headers, id, { ...turn(), page: "/admin?private=record" }))
          .status,
      ).toBe(422);
      expect(outbound).not.toHaveBeenCalled();
      const result = await send(f.care.headers, id, turn());
      expect(result.status).toBe(200);
      allieResponseSchemas.turns.parse(result.body.data);
      expect(result.body.data.conversation.audience).toBe("work");
      expect(result.headers["cache-control"]).toContain("no-store");
      expect(result.headers.vary).toContain("Cookie");
    });
    it("persists encrypted state and one receipt, then returns current owned history without regenerating on replay", async () => {
      const person = await f.account(null, "CUSTOMER"),
        created = await create(person.headers),
        id = created.body.data.conversation.id;
      const input = turn(1, "Find compatible parts for a synthetic vehicle question");
      const saved = await send(person.headers, id, input);
      expect(saved.status).toBe(200);
      const replay = await send(person.headers, id, input);
      expect(replay.status).toBe(200);
      expect(replay.body.data.replayed).toBe(true);
      expect(outbound).toHaveBeenCalledOnce();
      expect(replay.body.data.conversation.messages).toHaveLength(1);
      const row = await prisma.assistantConversation.findUniqueOrThrow({ where: { id } }),
        receipt = await prisma.assistantTurn.findFirstOrThrow({
          where: { conversationId: id },
        });
      expect(JSON.stringify(row.encryptedState).includes(input.question)).toBe(false);
      expect(JSON.stringify(receipt.encryptedResult).includes("A name match")).toBe(
        false,
      );
      expect(receipt).toMatchObject({
        status: "COMPLETED",
        inputTokens: 120,
        outputTokens: 60,
        totalTokens: 180,
        reservedTokens: 32000,
      });
      expect(() =>
        decryptAssistantContext(
          row.encryptedState as never,
          "wrong owner/conversation binding",
        ),
      ).toThrow("Assistant context is unavailable");
      expect(
        (await send(person.headers, id, { ...input, question: "A different question" }))
          .status,
      ).toBe(409);
      expect(outbound).toHaveBeenCalledOnce();
    });
    it("admits a pending turn once across independent HTTP requests and blocks another turn in that session", async () => {
      const person = await f.account(null, "CUSTOMER"),
        created = await create(person.headers),
        second = await create(person.headers),
        id = created.body.data.conversation.id,
        input = turn(),
        held = hold();
      const pending = send(person.headers, id, input).then((r) => r);
      await held.ready;
      expect((await send(person.headers, id, input)).status).toBe(409);
      expect(
        (await send(person.headers, second.body.data.conversation.id, turn())).status,
      ).toBe(409);
      expect(outbound).toHaveBeenCalledOnce();
      held.release();
      expect((await pending).status).toBe(200);
    });
    it("shares global concurrency and token reservations, preserving reviewed fallback help", async () => {
      const a = await f.account(null, "CUSTOMER"),
        b = await f.account(null, "CUSTOMER"),
        c1 = await create(a.headers),
        c2 = await create(b.headers),
        held = hold();
      env.ALLIE_AI_GLOBAL_CONCURRENCY = 1;
      try {
        const pending = send(a.headers, c1.body.data.conversation.id, turn()).then(
          (r) => r,
        );
        await held.ready;
        expect((await send(b.headers, c2.body.data.conversation.id, turn())).status).toBe(
          429,
        );
        held.release();
        expect((await pending).status).toBe(200);
      } finally {
        env.ALLIE_AI_GLOBAL_CONCURRENCY = 2;
      }
      behavior = async () => response();
      outbound.mockClear();
      const key = hashToken(
        "rate-limit",
        "assistant:daily-reservation:" + new Date().toISOString().slice(0, 10),
      );
      const bucket = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key } });
      env.ALLIE_AI_DAILY_TOKEN_LIMIT = bucket.hits;
      try {
        expect((await send(b.headers, c2.body.data.conversation.id, turn())).status).toBe(
          429,
        );
        expect(outbound).not.toHaveBeenCalled();
        expect((await request(app).get("/api/v1/public/learning/catalogue")).status).toBe(
          200,
        );
      } finally {
        env.ALLIE_AI_DAILY_TOKEN_LIMIT = 10000000;
      }
    });
    it("cancels through shared persisted state and never saves a late answer", async () => {
      const person = await f.account(null, "CUSTOMER"),
        created = await create(person.headers),
        id = created.body.data.conversation.id,
        input = turn(),
        held = hold();
      const pending = send(person.headers, id, input).then((r) => r);
      await held.ready;
      expect(
        (
          await request(app)
            .post(`${privatePath}/conversations/${id}/cancel`)
            .set(f.care.headers)
            .send({ operationId: input.operationId })
        ).status,
      ).toBe(404);
      const cancelled = await request(app)
        .post(`${privatePath}/conversations/${id}/cancel`)
        .set(person.headers)
        .send({ operationId: input.operationId });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.cancelled).toBe(true);
      const stopped = await pending;
      expect(stopped.status).toBe(409);
      expect((await read(person.headers, id)).body.data.messages).toEqual([]);
      expect(
        (await prisma.assistantTurn.findFirstOrThrow({ where: { conversationId: id } }))
          .status,
      ).toBe("CANCELLED");
    });
    it("rechecks actual responsibility expiry during generation, clears old guidance and discards the response", async () => {
      const person = await f.account("ACCOUNTANT"),
        created = await create(person.headers),
        id = created.body.data.conversation.id;
      const first = await send(person.headers, id, turn());
      expect(first.status).toBe(200);
      const held = hold(),
        pending = send(
          person.headers,
          id,
          turn(first.body.data.conversation.version),
        ).then((r) => r);
      await held.ready;
      await prisma.workforceAssignment.updateMany({
        where: { userId: person.user.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      held.release();
      const denied = await pending;
      expect([404, 409]).toContain(denied.status);
      const current = await read(person.headers, id);
      expect(current.status).toBe(200);
      expect(current.body.data.messages).toEqual([]);
      expect(current.body.data.historyReset).toBe(true);
      expect(
        (await prisma.assistantConversation.findUniqueOrThrow({ where: { id } }))
          .encryptedState,
      ).toBeNull();
      expect(
        await prisma.assistantTurn.count({
          where: { conversationId: id, status: "PENDING" },
        }),
      ).toBe(0);
    });
    it("rejects an expired session after generation and cannot expose the conversation from another session", async () => {
      const person = await f.account(null, "CUSTOMER"),
        created = await create(person.headers),
        id = created.body.data.conversation.id,
        held = hold();
      const pending = send(person.headers, id, turn()).then((r) => r);
      await held.ready;
      await prisma.session.update({
        where: { id: person.record.id },
        data: { revokedAt: new Date() },
      });
      held.release();
      expect([401, 404, 409]).toContain((await pending).status);
      const replacement = await f.session(person.user.id, "CUSTOMER");
      expect((await read(replacement.headers, id)).status).toBe(404);
      expect((await read(person.headers, id)).status).toBe(401);
    });
    it("makes clear/expiry erase server payloads, never replaying a cleared or failed turn", async () => {
      const person = await f.account(null, "CUSTOMER"),
        created = await create(person.headers),
        id = created.body.data.conversation.id,
        input = turn();
      expect((await send(person.headers, id, input)).status).toBe(200);
      const cleared = await request(app)
        .delete(`${privatePath}/conversations/${id}`)
        .set(person.headers)
        .send({});
      expect(cleared.status).toBe(200);
      expect((await read(person.headers, id)).status).toBe(404);
      expect(
        (await prisma.assistantConversation.findUniqueOrThrow({ where: { id } }))
          .encryptedState,
      ).toBeNull();
      expect(
        (await prisma.assistantTurn.findFirstOrThrow({ where: { conversationId: id } }))
          .encryptedResult,
      ).toBeNull();
      const next = await create(person.headers),
        nextId = next.body.data.conversation.id,
        nextInput = turn();
      behavior = async () =>
        new Response("isolated private provider failure", { status: 500 });
      expect((await send(person.headers, nextId, nextInput)).status).toBe(503);
      expect((await send(person.headers, nextId, nextInput)).status).toBe(409);
      expect(outbound).toHaveBeenCalledTimes(2);
      await prisma.assistantConversation.update({
        where: { id: nextId },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      expect((await read(person.headers, nextId)).status).toBe(404);
    });
    it("keeps cleanup bounded without already-empty rows starving expired private payloads", async () => {
      const at = new Date(),
        ownerKey = "f".repeat(64),
        accessKey = "e".repeat(64),
        sourceSet = "d".repeat(64);
      const base = {
        ownerKey,
        audience: "PUBLIC" as const,
        accessKey,
        sourceSet,
        absoluteExpiresAt: new Date(at.getTime() + 3600000),
      };
      await prisma.assistantConversation.create({
        data: { ...base, expiresAt: new Date(-10000) },
      });
      const id = randomUUID(),
        value = { history: { accessKey, sourceSet, turns: [] }, messages: [] };
      await prisma.assistantConversation.create({
        data: {
          ...base,
          id,
          expiresAt: new Date(0),
          encryptedState: encodeAllieState(
            value,
            JSON.stringify([id, ownerKey, "PUBLIC"]),
          ),
        },
      });
      const activeId = randomUUID();
      await prisma.assistantConversation.create({
        data: {
          ...base,
          id: activeId,
          expiresAt: new Date(at.getTime() + 60000),
          encryptedState: encodeAllieState(
            value,
            JSON.stringify([activeId, ownerKey, "PUBLIC"]),
          ),
        },
      });
      // Fixed ancient synthetic expiries put this pair ahead of retained fixtures
      // from earlier campaigns. No backlog size assumption or database reset.
      const result = await purgeExpiredAllieState(1);
      expect(result.payloadBatchesReviewed).toBe(1);
      expect(
        (await prisma.assistantConversation.findUniqueOrThrow({ where: { id } }))
          .encryptedState,
      ).toBeNull();
      expect(
        (
          await prisma.assistantConversation.findUniqueOrThrow({
            where: { id: activeId },
          })
        ).encryptedState === null,
      ).toBe(false);
    });
    it("enforces the added expiry/version/reservation constraints with the DML-only runtime", async () => {
      const created = await create(f.electrical.headers),
        conversationId = created.body.data.conversation.id;
      await expect(
        prisma.assistantConversation.update({
          where: { id: conversationId },
          data: { version: 0 },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.assistantTurn.create({
          data: {
            conversationId,
            operationId: randomUUID(),
            inputHash: "a".repeat(64),
            quotaKey: "b".repeat(64),
            reservedTokens: -1,
            leaseExpiresAt: new Date(Date.now() + 60000),
          },
        }),
      ).rejects.toThrow();
    });
  },
);
