import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import {
  publishPolicy,
  publicFulfillmentOptions,
} from "../../src/modules/policies/policies.service.js";
import { publicFulfillmentOptionsSchema } from "../../src/modules/policies/policies.schemas.js";
import { testOwner } from "../helpers/owner.js";
import { testCapability } from "../helpers/owner-policy.js";
const address =
  "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria";
const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
async function session(userId: string, privileged: boolean) {
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken(),
    now = new Date();
  const record = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      createdAt: now,
      lastRotatedAt: now,
      expiresAt: new Date(now.getTime() + 3_600_000),
      idleExpiresAt: new Date(now.getTime() + 3_600_000),
      mfaRequired: privileged,
      mfaVerifiedAt: privileged ? now : null,
    },
  });
  return {
    record,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrf,
    },
  };
}
async function version(key: string) {
  return (
    (
      await prisma.businessPolicyVersion.findFirst({
        where: { key },
        orderBy: { version: "desc" },
      })
    )?.version ?? 0
  );
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Approved delivery discovery and checkout",
  () => {
    afterAll(() => prisma.$disconnect());
    const app = createApp({ checkReadiness: async () => undefined });
    it("publishes only effective approved zones, prices checkout on the server and preserves replayed order snapshots", async () => {
      const owner = await testOwner("unusable-delivery-test-only");
      const ownerSession = await session(owner.id, true);
      await testCapability(owner.id, "FINANCE_POLICY_APPROVE");
      const actor = {
        userId: owner.id,
        email: owner.email,
        role: owner.role,
        sessionId: ownerSession.record.id,
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      await publishPolicy(
        actor,
        {
          kind: "FINANCE",
          expectedVersion: await version("finance"),
          effectiveAt: new Date().toISOString(),
          source: "Private synthetic accountant source",
          approvalEvidence: "Private synthetic accounting approval evidence.",
          settings: {
            vatBasisPoints: 750,
            pricesIncludeVat: false,
            rounding: "HALF_UP_MINOR_UNIT",
            discountTreatment: "BEFORE_VAT",
            deliveryTaxable: true,
            invoiceName: "Synthetic delivery company",
            invoiceAddress: "Synthetic invoice address only",
            paymentTerms: "Synthetic payment terms for testing",
            applicability: "ALL_PRODUCTS_AND_SERVICES",
          },
        },
        context,
      );
      const zone = {
        id: `zone-${randomUUID()}`,
        label: "Synthetic delivery area",
        city: "Port Harcourt",
        state: "Rivers",
        feeKobo: "10101",
      };
      const publish = async (
        zones: (typeof zone)[],
        effectiveAt = new Date().toISOString(),
      ) =>
        request(app)
          .post("/api/v1/admin/policies")
          .set(ownerSession.headers)
          .send({
            kind: "DELIVERY",
            expectedVersion: await version("delivery"),
            effectiveAt,
            source: "Private synthetic owner source",
            approvalEvidence: "Private synthetic delivery approval evidence.",
            settings: { collectionEnabled: true, collectionAddress: address, zones },
          });
      const approved = await publish([zone]);
      expect(approved.status).toBe(201);
      for (const invalidZones of [
        [],
        [zone, zone],
        [{ ...zone, feeKobo: "-1" }],
        [{ ...zone, city: "Port\nHarcourt" }],
      ]) {
        expect((await publish(invalidZones)).status).toBe(422);
      }
      const read = await request(app).get("/api/v1/public/fulfillment-options");
      expect(read.status).toBe(200);
      expect(read.headers["cache-control"]).toBe("no-store");
      expect(publicFulfillmentOptionsSchema.parse(read.body.data)).toEqual({
        serverTime: expect.any(String),
        currency: "NGN",
        checkoutEnabled: true,
        collection: { enabled: true, address },
        delivery: {
          enabled: true,
          policyVersion: approved.body.data.version,
          zones: [zone],
        },
      });
      expect(JSON.stringify(read.body.data)).not.toContain("Private synthetic");
      expect(read.body.data.delivery).not.toHaveProperty("approvalEvidence");
      const future = new Date(Date.now() + 86_400_000);
      const futureZone = { ...zone, feeKobo: "20202" };
      expect((await publish([futureZone], future.toISOString())).status).toBe(201);
      expect(
        (await request(app).get("/api/v1/public/fulfillment-options")).body.data.delivery
          .zones,
      ).toEqual([zone]);
      expect(
        (await publicFulfillmentOptions(prisma, new Date(future.getTime() + 1))).delivery
          .zones,
      ).toEqual([futureZone]);
      const customer = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-only",
          emailVerifiedAt: new Date(),
          profile: {
            create: {
              firstName: "Synthetic",
              lastName: "Delivery",
              phone: "+2348000000000",
              cart: { create: {} },
            },
          },
        },
        include: { profile: { include: { cart: true } } },
      });
      const customerSession = await session(customer.id, false);
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Synthetic delivery stock",
          address: "Test only",
          city: "Port Harcourt",
          state: "Rivers",
        },
      });
      const category = await prisma.category.create({
        data: { name: "Synthetic delivery", slug: randomUUID() },
      });
      const product = await prisma.product.create({
        data: {
          categoryId: category.id,
          name: "Synthetic product",
          slug: randomUUID(),
          sku: randomUUID(),
          priceKobo: 10000n,
        },
      });
      const inventory = await prisma.inventory.create({
        data: { branchId: branch.id, productId: product.id, quantity: 10 },
      });
      await prisma.cartItem.create({
        data: { cartId: customer.profile!.cart!.id, productId: product.id, quantity: 2 },
      });
      const key = randomUUID();
      const body = {
        branchId: branch.id,
        fulfillmentMethod: "DELIVERY",
        delivery: {
          zoneId: zone.id,
          name: "Synthetic Recipient",
          phone: "+2348000000000",
          address: "Synthetic delivery address",
          city: zone.city,
          state: zone.state,
          country: "Nigeria",
        },
      };
      const checkout = (payload: unknown, requestKey = randomUUID()) =>
        request(app)
          .post("/api/v1/customers/orders/checkout")
          .set(customerSession.headers)
          .set("Idempotency-Key", requestKey)
          .send(payload);
      expect(
        (
          await checkout({
            ...body,
            delivery: { ...body.delivery, city: "Different city" },
          })
        ).status,
      ).toBe(409);
      expect((await checkout({ ...body, deliveryFeeKobo: "1" })).status).toBe(422);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: inventory.id } }))
          .reserved,
      ).toBe(0);
      const created = await checkout(body, key);
      expect(created.status).toBe(201);
      expect(created.body.data.order).toMatchObject({
        fulfillmentMethod: "DELIVERY",
        subtotalKobo: "20000",
        deliveryFeeKobo: "10101",
        taxKobo: "2258",
        totalKobo: "32359",
        deliveryName: body.delivery.name,
        deliveryAddress: body.delivery.address,
      });
      expect(created.body.data.order).not.toHaveProperty("policySnapshot");
      const orderId = String(created.body.data.order.id);
      const saved = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(saved.policySnapshot).toMatchObject({
        fulfillment: {
          zoneId: zone.id,
          feeKobo: zone.feeKobo,
          policy: { version: approved.body.data.version },
        },
      });
      expect((await publish([{ ...zone, feeKobo: "30303" }])).status).toBe(201);
      const replay = await checkout(body, key);
      expect(replay.status).toBe(201);
      expect(replay.body.data).toMatchObject({
        replayed: true,
        order: { id: orderId, deliveryFeeKobo: "10101", totalKobo: "32359" },
      });
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: inventory.id } }))
          .reserved,
      ).toBe(2);
      expect(
        await publicFulfillmentOptions(prisma, new Date("1900-01-01T00:00:00Z")),
      ).toMatchObject({
        checkoutEnabled: false,
        delivery: { enabled: false, zones: [] },
      });
      const denied = await request(app)
        .get(`/api/v1/admin/policies?key=delivery`)
        .set(customerSession.headers);
      expect(denied.status).toBe(403);
    });
  },
);
