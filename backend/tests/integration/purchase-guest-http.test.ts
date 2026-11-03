import { randomUUID } from "node:crypto";
import { Router } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { publicLaunch } from "../../src/common/middleware/public-launch.js";
import { decryptIdentityPayload } from "../../src/common/security/mfa-encryption.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import {
  purchaseBrowserCookieName,
  purchaseCookieName,
  sessionCookieName,
} from "../../src/common/security/cookies.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import type { IdentityEmailPayload } from "../../src/modules/identity/identity.types.js";
import { createPurchaseRouter } from "../../src/modules/orders/purchase.routes.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type {
  InitializePaymentCommand,
  PaymentProviderPort,
} from "../../src/providers/payments/payment-provider.port.js";
import { account, fixture } from "../helpers/aftercare.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

const origin = "http://localhost:3000";
const freshApp = () => createApp({ checkReadiness: async () => undefined });
type App = ReturnType<typeof freshApp>;
function cookie(response: request.Response, name: string): string {
  const values = response.headers["set-cookie"] as unknown as string[];
  const selected = values?.findLast(
    (v) => v.startsWith(`${name}=`) && !v.startsWith(`${name}=;`),
  );
  if (!selected) throw Error(`Expected nonempty ${name} cookie`);
  return selected.split(";")[0]!;
}
async function proof(app: App, email = `guest-http-${randomUUID()}@example.test`) {
  const requested = await request(app)
    .post("/api/v1/purchase/access/request")
    .set("Origin", origin)
    .send({ email });
  expect(requested.status).toBe(202);
  const browser = cookie(requested, purchaseBrowserCookieName);
  const challenge = await prisma.purchaseGuestChallenge.findFirstOrThrow({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
  const queued = await prisma.outboxEvent.findFirstOrThrow({
    where: { aggregateId: challenge.id },
  });
  const payload = decryptIdentityPayload<IdentityEmailPayload>(
    (
      queued.payload as unknown as {
        encrypted: Parameters<typeof decryptIdentityPayload>[0];
      }
    ).encrypted,
  );
  const token = new URLSearchParams(new URL(payload.link).hash.slice(1)).get("token")!;
  return { requested, browser, token, email, link: payload.link };
}
async function verified(app: App, email?: string) {
  const p = await proof(app, email);
  const result = await request(app)
    .post("/api/v1/purchase/access/verify")
    .set("Origin", origin)
    .set("Cookie", p.browser)
    .send({ token: p.token });
  expect(result.status).toBe(200);
  const sessionCookie = cookie(result, purchaseCookieName);
  return { ...p, result, sessionCookie, csrf: result.body.data.csrfToken as string };
}
async function orderSetup(app: App) {
  const f = await fixture(),
    guest = await verified(app, f.customer.user.email);
  const body = {
    branchId: f.branch.id,
    fulfillmentMethod: "COLLECTION",
    contact: { name: "Synthetic HTTP Buyer", phone: "+2348000000000" },
    items: [{ productId: f.inventory.productId, quantity: 2 }],
  };
  return { ...f, guest, body };
}
const createOrder = (
  app: App,
  f: Awaited<ReturnType<typeof orderSetup>>,
  key = randomUUID(),
) =>
  request(app)
    .post("/api/v1/purchase/orders")
    .set("Origin", origin)
    .set("Cookie", f.guest.sessionCookie)
    .set("X-CSRF-Token", f.guest.csrf)
    .set("Idempotency-Key", key)
    .send(f.body);

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "guest purchase HTTP boundary",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterAll(() => prisma.$disconnect());

    it("returns the access link to its requesting approved origin when the configured email alias differs", async () => {
      const previous = env.FRONTEND_VERIFY_EMAIL_URL;
      env.FRONTEND_VERIFY_EMAIL_URL = "https://other-approved-alias.example/verify-email";
      try {
        const requested = await proof(freshApp());
        expect(new URL(requested.link).origin).toBe(origin);
        expect(new URL(requested.link).pathname).toBe("/purchase/verify");
        expect(new URL(requested.link).search).toBe("");
      } finally {
        env.FRONTEND_VERIFY_EMAIL_URL = previous;
      }
    });

    it("consumes a browser-bound proof without creating an account, order or payment and never returns the session token", async () => {
      const app = freshApp(),
        user = await account("CUSTOMER");
      const counts = {
        users: await prisma.user.count(),
        orders: await prisma.order.count(),
        payments: await prisma.payment.count(),
      };
      const guest = await verified(app, user.user.email);
      expect(guest.result.body.data).toEqual({
        email: user.user.email,
        buyerReference: expect.any(String),
        expiresAt: expect.any(String),
        csrfToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      });
      const header = (guest.result.headers["set-cookie"] as unknown as string[]).findLast(
        (v) => v.startsWith(`${purchaseCookieName}=`),
      )!;
      expect(header).toContain("HttpOnly");
      expect(header).toContain("SameSite=Lax");
      expect(header).toContain("Path=/");
      expect(header).not.toContain("Domain=");
      expect(JSON.stringify(guest.result.body)).not.toContain(
        guest.sessionCookie.split("=")[1],
      );
      expect(guest.result.headers["cache-control"]).toContain("no-store");
      expect(await prisma.user.count()).toBe(counts.users);
      expect(await prisma.order.count()).toBe(counts.orders);
      expect(await prisma.payment.count()).toBe(counts.payments);
      expect(
        (
          await request(app)
            .get("/api/v1/auth/session")
            .set("Cookie", guest.sessionCookie)
        ).status,
      ).toBe(401);
      const current = await request(app)
        .get("/api/v1/purchase/access")
        .set("Cookie", guest.sessionCookie);
      expect(current.status).toBe(200);
      expect(current.body.data.email).toBe(user.user.email);
      expect(Object.keys(current.body.data).sort()).toEqual([
        "buyerReference",
        "email",
        "expiresAt",
      ]);
    });

    it("refuses missing or other-browser binding, replay and credentials in the query", async () => {
      const app = freshApp(),
        p = await proof(app),
        other = await proof(app);
      for (const binding of ["", other.browser]) {
        const result = await request(app)
          .post("/api/v1/purchase/access/verify")
          .set("Origin", origin)
          .set("Cookie", binding)
          .send({ token: p.token });
        expect(result.status).toBe(401);
      }
      const query = await request(app)
        .post(`/api/v1/purchase/access/verify?token=${p.token}`)
        .set("Origin", origin)
        .set("Cookie", p.browser)
        .send({ token: p.token });
      expect(query.status).toBe(422);
      const first = await request(app)
        .post("/api/v1/purchase/access/verify")
        .set("Origin", origin)
        .set("Cookie", p.browser)
        .send({ token: p.token });
      expect(first.status).toBe(200);
      expect(
        (
          await request(app)
            .post("/api/v1/purchase/access/verify")
            .set("Origin", origin)
            .set("Cookie", p.browser)
            .send({ token: p.token })
        ).status,
      ).toBe(401);
    });

    it("requires the exact trusted origin for access requests and rejects overposting before queueing", async () => {
      const app = freshApp(),
        count = await prisma.purchaseGuestChallenge.count();
      expect(
        (
          await request(app)
            .post("/api/v1/purchase/access/request")
            .send({ email: "synthetic@example.test" })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/v1/purchase/access/request")
            .set("Origin", origin)
            .set("Sec-Fetch-Site", "cross-site")
            .send({ email: "synthetic@example.test" })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/v1/purchase/access/request")
            .set("Origin", origin)
            .send({ email: "synthetic@example.test", role: "ADMIN" })
        ).status,
      ).toBe(422);
      expect(await prisma.purchaseGuestChallenge.count()).toBe(count);
    });

    it("bounds purchase-link requests by the sensitive IP limiter", async () => {
      const app = freshApp();
      for (let i = 0; i < 5; i++)
        expect(
          (
            await request(app)
              .post("/api/v1/purchase/access/request")
              .set("Origin", origin)
              .send({ email: `rate-${randomUUID()}@example.test` })
          ).status,
        ).toBe(202);
      const last = await request(app)
        .post("/api/v1/purchase/access/request")
        .set("Origin", origin)
        .send({ email: `rate-${randomUUID()}@example.test` });
      expect(last.status).toBe(429);
      expect(last.headers["retry-after"]).toBeDefined();
    });

    it("refuses normal and MFA-pending account cookies before issuing guest access", async () => {
      const app = freshApp(),
        customer = await account("CUSTOMER"),
        pending = await account("ADMIN", undefined, false);
      const count = await prisma.purchaseGuestChallenge.count();
      for (const actor of [customer, pending]) {
        const result = await request(app)
          .post("/api/v1/purchase/access/request")
          .set(actor.headers)
          .send({ email: actor.user.email });
        expect(result.status).toBe(409);
      }
      expect(await prisma.purchaseGuestChallenge.count()).toBe(count);
      expect(
        (await request(app).get("/api/v1/auth/session").set(pending.headers)).body.data
          .mfaRequired,
      ).toBe(true);
    });

    it("rotates CSRF through trusted origin, invalidates the previous token and revokes current access", async () => {
      const app = freshApp(),
        guest = await verified(app);
      expect(
        (
          await request(app)
            .post("/api/v1/purchase/access/csrf")
            .set("Cookie", guest.sessionCookie)
            .send({})
        ).status,
      ).toBe(403);
      const rotated = await request(app)
        .post("/api/v1/purchase/access/csrf")
        .set("Cookie", guest.sessionCookie)
        .set("Origin", origin)
        .send({});
      expect(rotated.status).toBe(200);
      expect(rotated.body.data.csrfToken).not.toBe(guest.csrf);
      expect(
        (
          await request(app)
            .delete("/api/v1/purchase/access")
            .set("Origin", origin)
            .set("Cookie", guest.sessionCookie)
            .set("X-CSRF-Token", guest.csrf)
            .send({})
        ).status,
      ).toBe(403);
      const ended = await request(app)
        .delete("/api/v1/purchase/access")
        .set("Origin", origin)
        .set("Cookie", guest.sessionCookie)
        .set("X-CSRF-Token", rotated.body.data.csrfToken)
        .send({});
      expect(ended.status).toBe(200);
      expect(
        (ended.headers["set-cookie"] as unknown as string[]).some((v) =>
          v.startsWith(`${purchaseCookieName}=;`),
        ),
      ).toBe(true);
      expect(
        (
          await request(app)
            .get("/api/v1/purchase/access")
            .set("Cookie", guest.sessionCookie)
        ).status,
      ).toBe(401);
    });

    it("refuses expired guest sessions before reading history or rotating CSRF", async () => {
      const app = freshApp(),
        guest = await verified(app);
      await prisma.purchaseGuestSession.updateMany({
        where: {
          tokenHash: hashToken(
            "purchase-guest-session",
            guest.sessionCookie.split("=")[1]!,
          ),
        },
        data: { idleExpiresAt: new Date(Date.now() - 1000) },
      });
      expect(
        (
          await request(app)
            .get("/api/v1/purchase/orders")
            .set("Cookie", guest.sessionCookie)
        ).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .post("/api/v1/purchase/access/csrf")
            .set("Origin", origin)
            .set("Cookie", guest.sessionCookie)
            .send({})
        ).status,
      ).toBe(401);
    });

    it("saves exact server totals once, recovers the original receipt and scopes list/detail/cursors to the verified buyer", async () => {
      const app = freshApp(),
        f = await orderSetup(app),
        key = randomUUID();
      const result = await createOrder(app, f, key);
      expect(result.status).toBe(201);
      const id = result.body.data.order.id;
      expect(result.body.data.order).toMatchObject({
        totalKobo: "21500",
        customerEmail: f.guest.email,
        status: "PENDING",
        paidAt: null,
      });
      const replay = await createOrder(app, f, key);
      expect(replay.body.data).toMatchObject({ replayed: true, order: { id } });
      const recovered = await request(app)
        .get("/api/v1/purchase/orders/original-request")
        .set("Cookie", f.guest.sessionCookie)
        .set("Idempotency-Key", key);
      expect(recovered.status).toBe(200);
      expect(recovered.body.data).toMatchObject({ found: true, order: { id } });
      const list = await request(app)
        .get("/api/v1/purchase/orders?limit=1")
        .set("Cookie", f.guest.sessionCookie);
      expect(list.body.data.items.map((v: { id: string }) => v.id)).toEqual([id]);
      const other = await verified(app);
      expect(
        (
          await request(app)
            .get(`/api/v1/purchase/orders/${id}`)
            .set("Cookie", other.sessionCookie)
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .get(`/api/v1/purchase/orders?cursor=${id}`)
            .set("Cookie", other.sessionCookie)
        ).status,
      ).toBe(404);
      const missing = await request(app)
        .get("/api/v1/purchase/orders/original-request")
        .set("Cookie", other.sessionCookie)
        .set("Idempotency-Key", key);
      expect(missing.body.data).toEqual({ found: false, order: null });
      expect(
        (await request(app).get(`/api/v1/customers/orders/${id}`).set(f.customer.headers))
          .status,
      ).toBe(404);
    });

    it("rejects price/identity overposting, missing CSRF and wrong CSRF without reserving stock", async () => {
      const app = freshApp(),
        f = await orderSetup(app),
        before = await prisma.inventory.findUniqueOrThrow({
          where: { id: f.inventory.id },
        });
      const url = "/api/v1/purchase/orders";
      const post = () =>
        request(app)
          .post(url)
          .set("Origin", origin)
          .set("Cookie", f.guest.sessionCookie)
          .set("Idempotency-Key", randomUUID());
      expect((await post().send(f.body)).status).toBe(422);
      expect((await post().set("X-CSRF-Token", "a".repeat(43)).send(f.body)).status).toBe(
        403,
      );
      expect(
        (
          await post()
            .set("X-CSRF-Token", f.guest.csrf)
            .send({ ...f.body, totalKobo: "1", guestId: randomUUID() })
        ).status,
      ).toBe(422);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: f.inventory.id } }))
          .reserved,
      ).toBe(before.reserved);
    });

    it("closes direct financial requests in a limited release while keeping owned history and security recovery", async () => {
      const app = freshApp(),
        f = await orderSetup(app),
        result = await createOrder(app, f);
      expect(result.status).toBe(201);
      const previous = env.PUBLIC_LAUNCH_MODE;
      env.PUBLIC_LAUNCH_MODE = "browse_enquiries";
      try {
        const limited = freshApp();
        expect((await createOrder(limited, f)).status).toBe(403);
        expect(
          (
            await request(limited)
              .post("/api/v1/purchase/payments")
              .set("Origin", origin)
              .set("Cookie", f.guest.sessionCookie)
              .set("X-CSRF-Token", f.guest.csrf)
              .set("Idempotency-Key", randomUUID())
              .send({ orderId: result.body.data.order.id })
          ).status,
        ).toBe(403);
        expect(
          (
            await request(limited)
              .get(`/api/v1/purchase/orders/${result.body.data.order.id}`)
              .set("Cookie", f.guest.sessionCookie)
          ).status,
        ).toBe(200);
        expect(
          (
            await request(limited)
              .post("/api/v1/purchase/access/csrf")
              .set("Origin", origin)
              .set("Cookie", f.guest.sessionCookie)
              .send({})
          ).status,
        ).toBe(200);
        env.PUBLIC_LAUNCH_MODE = "catalogue";
        const closed = freshApp();
        expect(
          (
            await request(closed)
              .get("/api/v1/purchase/access")
              .set("Cookie", f.guest.sessionCookie)
          ).status,
        ).toBe(403);
        expect(
          (
            await request(closed)
              .get(`/api/v1/purchase/orders/${result.body.data.order.id}`)
              .set("Cookie", f.guest.sessionCookie)
          ).status,
        ).toBe(403);
      } finally {
        env.PUBLIC_LAUNCH_MODE = previous;
      }
    });

    it("maps HTTP intent, checkout, verification and recovery to the owned order without trusting callback claims", async () => {
      const commands: InitializePaymentCommand[] = [];
      const port: PaymentProviderPort = {
        async initialize(input) {
          commands.push(input);
          return {
            providerReference: input.reference,
            authorizationUrl: `https://checkout.paystack.com/${input.reference}`,
            accessCode: "synthetic",
            authorizationExpiresAt: new Date(Date.now() + 600_000),
          };
        },
        async verify(reference) {
          return {
            reference,
            gatewayTransactionId: `synthetic-${reference}`,
            status: "success",
            amountKobo: 21500n,
            currency: "NGN",
            paidAt: new Date(),
            providerFeeKobo: 0n,
            method: "card",
          };
        },
        async refund() {
          throw Error("No external financial actions in HTTP fixture");
        },
      };
      const router = Router();
      router.use(
        publicLaunch("full", {
          bookingRequestsEnabled: true,
          productPurchasesEnabled: true,
        }),
      );
      router.use(
        "/purchase",
        createPurchaseRouter(
          undefined,
          undefined,
          new PaymentsService(prisma, new PaymentProviderRegistry({ PAYSTACK: port })),
        ),
      );
      const app = createApp({ apiRouter: router, checkReadiness: async () => undefined }),
        f = await orderSetup(app);
      const order = await createOrder(app, f);
      expect(order.status).toBe(201);
      const headers = {
        Origin: origin,
        Cookie: f.guest.sessionCookie,
        "X-CSRF-Token": f.guest.csrf,
      };
      const intentKey = randomUUID();
      const intent = await request(app)
        .post("/api/v1/purchase/payments")
        .set(headers)
        .set("Idempotency-Key", intentKey)
        .send({ orderId: order.body.data.order.id });
      expect(intent.status).toBe(201);
      const paymentId = intent.body.data.payment.id;
      const ownedOrder = await request(app)
        .get(`/api/v1/purchase/orders/${order.body.data.order.id}`)
        .set(headers);
      expect(ownedOrder.status).toBe(200);
      expect(ownedOrder.body.data.paymentId).toBe(paymentId);
      const bad = await request(app)
        .post("/api/v1/purchase/payments")
        .set(headers)
        .set("Idempotency-Key", intentKey)
        .send({ orderId: order.body.data.order.id, amountKobo: "1" });
      expect(bad.status).toBe(422);
      const key = randomUUID(),
        checkoutPath = `/api/v1/purchase/payments/${paymentId}/checkout`;
      const checkout = await request(app)
        .post(checkoutPath)
        .set(headers)
        .set("Idempotency-Key", key)
        .send({ provider: "PAYSTACK" });
      expect(checkout.status).toBe(200);
      expect(commands).toHaveLength(1);
      expect(commands[0]!.amountKobo).toBe(21500n);
      expect(new URL(commands[0]!.callbackUrl!).origin).toBe(origin);
      expect(new URL(commands[0]!.callbackUrl!).pathname).toBe("/purchase/complete");
      const replay = await request(app)
        .post(checkoutPath)
        .set(headers)
        .set("Idempotency-Key", key)
        .send({ provider: "PAYSTACK" });
      expect(replay.body.data.replayed).toBe(true);
      expect(commands).toHaveLength(1);
      expect(
        (
          await request(app)
            .get(`/api/v1/purchase/payments/${paymentId}?paid=true`)
            .set(headers)
        ).status,
      ).toBe(422);
      const before = await request(app)
        .get(`/api/v1/purchase/payments/${paymentId}`)
        .set(headers);
      expect(before.body.data.status).not.toBe("SUCCEEDED");
      const verifyPath = `/api/v1/purchase/payments/${paymentId}/attempts/${checkout.body.data.attemptId}/verify`;
      const other = await verified(app);
      expect(
        (
          await request(app)
            .post(verifyPath)
            .set("Origin", origin)
            .set("Cookie", other.sessionCookie)
            .set("X-CSRF-Token", other.csrf)
            .send({})
        ).status,
      ).toBe(404);
      expect((await request(app).post(verifyPath).set(headers).send({})).status).toBe(
        200,
      );
      expect((await request(app).post(verifyPath).set(headers).send({})).status).toBe(
        200,
      );
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: checkout.body.data.attemptId, type: "CAPTURE" },
        }),
      ).toBe(1);
      const saved = await prisma.order.findUniqueOrThrow({
        where: { id: order.body.data.order.id },
      });
      expect(saved.paidAt).not.toBeNull();
      expect(saved.status).toBe("PENDING");
      expect(saved.readyAt).toBeNull();
    });

    it("clears guest cookies when a genuine account session is issued", async () => {
      const app = freshApp(),
        guest = await verified(app),
        user = await account("CUSTOMER");
      // Genuine account-CSRF rotation does not issue an account identity; login does.
      // Exercise the shared issuance function used by login and MFA rotation directly.
      const { setSessionCookie } = await import("../../src/common/security/cookies.js");
      const writes: string[] = [];
      const fakeResponse = {
        cookie(name: string) {
          writes.push(`set:${name}`);
        },
        clearCookie(name: string) {
          writes.push(`clear:${name}`);
        },
      };
      setSessionCookie(
        fakeResponse as never,
        "synthetic-account-token",
        new Date(Date.now() + 1000),
      );
      expect(writes).toEqual([
        `set:${sessionCookieName}`,
        `clear:${purchaseCookieName}`,
        `clear:${purchaseBrowserCookieName}`,
      ]);
      expect(
        (
          await request(app)
            .get("/api/v1/purchase/access")
            .set("Cookie", `${guest.sessionCookie}; ${user.headers.Cookie}`)
        ).status,
      ).toBe(409);
    });
  },
);
