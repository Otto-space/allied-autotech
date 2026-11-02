import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  decryptIdentityPayload,
  encryptTotpSecret,
  serializeEncryptedEnvelope,
} from "../../src/common/security/mfa-encryption.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { prisma } from "../../src/config/database.js";
import { identityEventTypes } from "../../src/modules/identity/identity.events.js";
import type { IdentityEmailPayload } from "../../src/modules/identity/identity.types.js";
import {
  PurchaseGuestAccessService,
  purchaseGuestAccessMessage,
} from "../../src/modules/orders/purchase-guest-access.service.js";
import type { TransactionalEmail } from "../../src/providers/messaging/email-provider.port.js";
import { IdentityOutboxWorker } from "../../src/workers/outbox.worker.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

const service = new PurchaseGuestAccessService();
const freshEmail = () => `guest-${randomUUID()}@example.test`;
async function proof(email = freshEmail(), browserToken?: string) {
  const result = await service.request(email, browserToken);
  const challenge = await prisma.purchaseGuestChallenge.findFirstOrThrow({
    where: { email: email.trim().normalize("NFKC").toLowerCase() },
    orderBy: { createdAt: "desc" },
  });
  const outbox = await prisma.outboxEvent.findFirstOrThrow({
    where: {
      aggregateId: challenge.id,
      eventType: identityEventTypes.purchaseGuestAccessRequested,
    },
  });
  const payload = decryptIdentityPayload<IdentityEmailPayload>(
    (
      outbox.payload as unknown as {
        encrypted: Parameters<typeof decryptIdentityPayload>[0];
      }
    ).encrypted,
  );
  const token = new URLSearchParams(new URL(payload.link).hash.slice(1)).get("token")!;
  return { result, challenge, outbox, payload, token };
}
async function session(email?: string, previousSessionToken?: string) {
  const value = await proof(email);
  return service.verify(value.token, value.result.browserToken, previousSessionToken);
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "isolated guest purchase access",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterAll(() => prisma.$disconnect());

    it("encrypts browser-bound single-use proof without creating or authenticating an account", async () => {
      const email = freshEmail();
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: "synthetic-existing-account-not-a-login",
          role: "CUSTOMER",
          emailVerifiedAt: new Date(),
          mfaFactors: {
            create: {
              type: "TOTP",
              status: "ACTIVE",
              verifiedAt: new Date(),
              encryptedSecret: Buffer.from(
                serializeEncryptedEnvelope(encryptTotpSecret("JBSWY3DPEHPK3PXP")),
              ),
              encryptionKeyId: "test-v1",
            },
          },
        },
        select: {
          id: true,
          email: true,
          mfaFactors: {
            select: { id: true, type: true, status: true, encryptedSecret: true },
          },
          passwordHash: true,
        },
      });
      const before = [
        await prisma.user.count(),
        await prisma.customerProfile.count(),
        await prisma.session.count(),
        await prisma.order.count(),
      ];
      const value = await proof(`  ${email.toUpperCase()}  `);
      expect(value.result.message).toBe(purchaseGuestAccessMessage);
      expect(value.challenge.email).toBe(email);
      expect(value.challenge.tokenHash).toBe(
        hashToken("purchase-guest-proof", value.token),
      );
      expect(value.challenge.browserBindingHash).toBe(
        hashToken("purchase-guest-browser", value.result.browserToken),
      );
      expect(JSON.stringify(value.outbox.payload)).not.toContain(value.token);
      expect(JSON.stringify(value.outbox.payload)).not.toContain(email);
      expect(value.payload.template).toBe("purchase-guest-access");
      expect(new URL(value.payload.link).search).toBe("");
      expect(new URL(value.payload.link).pathname).toBe("/purchase/verify");
      expect(value.result).not.toHaveProperty("token");
      const issued = await service.verify(value.token, value.result.browserToken);
      expect(issued.access.email).toBe(email);
      expect([
        await prisma.user.count(),
        await prisma.customerProfile.count(),
        await prisma.session.count(),
        await prisma.order.count(),
      ]).toEqual(before);
      expect(
        await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            mfaFactors: {
              select: { id: true, type: true, status: true, encryptedSecret: true },
            },
            passwordHash: true,
          },
        }),
      ).toEqual(user);
      const accountAttempt = await request(
        createApp({ checkReadiness: async () => undefined }),
      )
        .get("/api/v1/auth/session")
        .set("Cookie", `aat_session=${issued.sessionToken}`);
      expect(accountAttempt.status).toBe(401);
    });

    it("rejects another browser and malformed proof without consuming a valid link", async () => {
      const value = await proof();
      await expect(
        service.verify(value.token, generateOpaqueToken()),
      ).rejects.toMatchObject({ statusCode: 401 });
      await expect(
        service.verify("not-a-token", value.result.browserToken),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(
        (
          await prisma.purchaseGuestChallenge.findUniqueOrThrow({
            where: { id: value.challenge.id },
          })
        ).consumedAt,
      ).toBeNull();
      expect(
        (await service.verify(value.token, value.result.browserToken)).access.email,
      ).toBe(value.challenge.email);
    });

    it("permits exactly one concurrent consumption and rejects replay", async () => {
      const value = await proof();
      const outcomes = await Promise.allSettled([
        service.verify(value.token, value.result.browserToken),
        service.verify(value.token, value.result.browserToken),
      ]);
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
      await expect(
        service.verify(value.token, value.result.browserToken),
      ).rejects.toMatchObject({ statusCode: 401 });
      const guest = await prisma.purchaseGuest.findUniqueOrThrow({
        where: { email: value.challenge.email },
      });
      expect(
        await prisma.purchaseGuestSession.count({ where: { guestId: guest.id } }),
      ).toBe(1);
    });

    it("does not consume expired proof", async () => {
      const value = await proof();
      await prisma.purchaseGuestChallenge.update({
        where: { id: value.challenge.id },
        data: {
          createdAt: new Date(Date.now() - 60 * 60_000),
          expiresAt: new Date(Date.now() - 1_000),
        },
      });
      await expect(
        service.verify(value.token, value.result.browserToken),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(
        await prisma.purchaseGuest.count({ where: { email: value.challenge.email } }),
      ).toBe(0);
    });

    it("serializes recipient limits across simultaneous requests with the same generic response", async () => {
      const email = freshEmail();
      const outcomes = await Promise.all(
        Array.from({ length: 7 }, () => service.request(email)),
      );
      expect(new Set(outcomes.map((r) => r.message))).toEqual(
        new Set([purchaseGuestAccessMessage]),
      );
      const challenges = await prisma.purchaseGuestChallenge.findMany({
        where: { email },
        select: { id: true },
      });
      expect(challenges).toHaveLength(3);
      expect(
        await prisma.outboxEvent.count({
          where: { aggregateId: { in: challenges.map((c) => c.id) } },
        }),
      ).toBe(3);
      expect(await prisma.purchaseGuest.count({ where: { email } })).toBe(0);
    });

    it("requires current CSRF for writes and invalidates old tokens on rotation", async () => {
      const issued = await session();
      const original = await service.access(issued.sessionToken, {
        kind: "write",
        csrfToken: issued.csrfToken,
      });
      expect(original).toEqual(issued.access);
      await expect(
        service.access(issued.sessionToken, {
          kind: "write",
          csrfToken: generateOpaqueToken(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      const next = await service.rotateCsrf(issued.sessionToken);
      await expect(
        service.access(issued.sessionToken, {
          kind: "write",
          csrfToken: issued.csrfToken,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        service.access(issued.sessionToken, { kind: "write", csrfToken: "" }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(
        await service.access(issued.sessionToken, { kind: "write", csrfToken: next }),
      ).toEqual(original);
      const stored = await prisma.purchaseGuestSession.findUniqueOrThrow({
        where: { id: issued.access.sessionId },
      });
      expect(stored.csrfTokenHash).toBe(hashToken("csrf", next));
      expect(stored.tokenHash).not.toBe(hashToken("session", issued.sessionToken));
      expect(JSON.stringify(stored)).not.toContain(issued.sessionToken);
      expect(JSON.stringify(stored)).not.toContain(next);
    });

    it.each(["idle", "absolute"] as const)(
      "rejects a session after %s expiry",
      async (kind) => {
        const issued = await session();
        await prisma.purchaseGuestSession.update({
          where: { id: issued.access.sessionId },
          data:
            kind === "idle"
              ? { idleExpiresAt: new Date(Date.now() - 1_000) }
              : {
                  createdAt: new Date(Date.now() - 60 * 60_000),
                  expiresAt: new Date(Date.now() - 1_000),
                  idleExpiresAt: new Date(Date.now() - 2_000),
                },
        });
        await expect(
          service.access(issued.sessionToken, { kind: "read" }),
        ).rejects.toMatchObject({ statusCode: 401 });
        await expect(service.rotateCsrf(issued.sessionToken)).rejects.toMatchObject({
          statusCode: 401,
        });
      },
    );

    it("revokes one session or all its guest sessions without affecting another guest", async () => {
      const email = freshEmail();
      const first = await session(email);
      const second = await session(email);
      const third = await session(email);
      const unrelated = await session();
      await service.revoke(first.sessionToken, first.csrfToken);
      await expect(
        service.access(first.sessionToken, { kind: "read" }),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect((await service.access(second.sessionToken, { kind: "read" })).guestId).toBe(
        first.access.guestId,
      );
      await service.revoke(second.sessionToken, second.csrfToken, true);
      await expect(
        service.access(third.sessionToken, { kind: "read" }),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(await service.access(unrelated.sessionToken, { kind: "read" })).toEqual(
        unrelated.access,
      );
    });

    it("rotates browser ownership when replacing a guest session", async () => {
      const first = await session();
      const second = await session(undefined, first.sessionToken);
      expect(second.access.guestId).not.toBe(first.access.guestId);
      await expect(
        service.access(first.sessionToken, { kind: "read" }),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(await service.access(second.sessionToken, { kind: "read" })).toEqual(
        second.access,
      );
    });

    it("delivers the branded guest link only through an injected fake email transport", async () => {
      const value = await proof();
      const delivered: TransactionalEmail[] = [];
      const worker = new IdentityOutboxWorker({
        async send(message) {
          delivered.push(message);
        },
      });
      await worker.runOnce(100);
      const message = delivered.find((r) => r.to === value.challenge.email);
      expect(message?.subject).toContain("private Allied AutoTech purchase link");
      expect(message?.text).toContain("15 minutes");
      expect(message?.text).toContain("never to a customer account");
      expect(message?.text).toContain(value.payload.link);
      expect(
        (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: value.outbox.id } }))
          .status,
      ).toBe("PUBLISHED");
    });

    it("cleans only old expired proof/session state and retains active access and guest identity", async () => {
      const active = await session();
      const expired = await session();
      const pending = await proof();
      const old = await proof();
      const past = new Date(Date.now() - 40 * 86_400_000);
      await prisma.purchaseGuestSession.update({
        where: { id: expired.access.sessionId },
        data: {
          createdAt: new Date(past.getTime() - 60_000),
          expiresAt: past,
          idleExpiresAt: past,
        },
      });
      await prisma.purchaseGuestChallenge.update({
        where: { id: old.challenge.id },
        data: { createdAt: new Date(past.getTime() - 60_000), expiresAt: past },
      });
      const worker = new IdentityOutboxWorker(null);
      expect(await worker.cleanupExpiredIdentityState()).toBeGreaterThanOrEqual(2);
      expect(
        await prisma.purchaseGuestSession.findUnique({
          where: { id: expired.access.sessionId },
        }),
      ).toBeNull();
      expect(
        await prisma.purchaseGuestChallenge.findUnique({
          where: { id: old.challenge.id },
        }),
      ).toBeNull();
      expect(
        await prisma.purchaseGuest.findUnique({ where: { id: expired.access.guestId } }),
      ).not.toBeNull();
      expect(await service.access(active.sessionToken, { kind: "read" })).toEqual(
        active.access,
      );
      expect(
        (await service.verify(pending.token, pending.result.browserToken)).access.email,
      ).toBe(pending.challenge.email);
    });
  },
);
