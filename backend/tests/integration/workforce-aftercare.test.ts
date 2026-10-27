import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { fixture as aftercareFixture } from "../helpers/aftercare.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "scoped financial aftercare",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let original: Awaited<ReturnType<typeof aftercareFixture>>;
    const note =
      "Synthetic reviewed financial basis and received condition evidence checked";
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      original = await aftercareFixture();
    }, 30000);
    afterAll(() => prisma.$disconnect());
    async function actor(
      options: {
        grant?: boolean;
        scope?: boolean;
        role?: "STAFF" | "ADMIN";
        branchId?: string;
      } = {},
    ) {
      const who = await f.account(
        options.scope === false ? "CUSTOMER_SERVICE" : "ACCOUNTANT",
        options.role ?? "STAFF",
        options.branchId ?? f.home.id,
      );
      const grant =
        options.grant === false
          ? undefined
          : await prisma.userCapability.create({
              data: {
                userId: who.user.id,
                capability: "FINANCE_POLICY_APPROVE",
                grantedByUserId: f.owner.id,
              },
            });
      return { ...who, grant };
    }
    async function record(
      options: {
        branchId?: string;
        status?: string;
        kind?: "RETURN" | "CANCELLATION";
        confirmed?: boolean;
      } = {},
    ) {
      const base = original.order;
      const order = await prisma.order.create({
        data: {
          orderNumber: `WF-${randomUUID().slice(0, 20)}`,
          customerId: base.customerId,
          customerName: base.customerName,
          customerEmail: base.customerEmail,
          customerPhone: base.customerPhone,
          subtotalKobo: base.subtotalKobo,
          totalKobo: base.totalKobo,
          status: base.status,
          fulfillmentMethod: base.fulfillmentMethod,
          paidAt: base.paidAt,
          completedAt: base.completedAt,
          branchId: options.branchId ?? f.home.id,
          confirmedAt: options.confirmed === false ? null : base.confirmedAt,
          items: {
            create: base.items.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              sku: line.sku,
              quantity: line.quantity,
              unitPriceKobo: line.unitPriceKobo,
              subtotalKobo: line.subtotalKobo,
            })),
          },
        },
        include: { items: true },
      });
      const status = options.status ?? "INSPECTED";
      const row = await prisma.orderAftercareRequest.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          kind: options.kind ?? "RETURN",
          status,
          reason: "Synthetic customer requested one damaged item review",
          reviewReason: "SYNTHETIC_REVIEW",
          items: [{ orderItemId: order.items[0]!.id, quantity: 1 }],
          receivedAt: status === "INSPECTED" ? new Date() : null,
          inspectedAt: status === "INSPECTED" ? new Date() : null,
          inspectedByUserId: status === "INSPECTED" ? f.mechanical1.user.id : null,
          inspectionNote: status === "INSPECTED" ? "Synthetic inspected condition" : null,
          goodCondition: status === "INSPECTED" ? true : null,
          policySnapshot: {
            id: randomUUID(),
            key: "cancellation",
            version: 1,
            approvalStatus: "APPROVED",
            source: "Synthetic reviewed financial policy",
            effectiveAt: new Date(Date.now() - 1000).toISOString(),
            settings: { privateDiagnostic: "Must not enter projection" },
          },
        },
      });
      return { order, row };
    }
    const get = (who: { headers: Record<string, string> }, path: string) =>
      request(app).get(`/api/v1/staff/workforce/aftercare${path}`).set(who.headers);
    const send = (who: { headers: Record<string, string> }, id: string, body: object) =>
      request(app)
        .post(`/api/v1/staff/workforce/aftercare/${id}/decision`)
        .set(who.headers)
        .send(body);
    async function body(who: { headers: Record<string, string> }, id: string) {
      const detail = await get(who, `/${id}`);
      expect(detail.status).toBe(200);
      return {
        stage: "APPROVED",
        note,
        approvedFeeKobo: "0",
        expectedStatus: detail.body.data.status,
        expectedRevision: detail.body.data.reviewRevision,
      };
    }
    it("provides a scoped populated queue and minimal decision evidence without customer or raw policy data", async () => {
      const who = await actor(),
        v = await record();
      const list = await get(who, `?q=${v.order.orderNumber}`);
      expect(list.status).toBe(200);
      expect(list.headers["cache-control"]).toContain("no-store");
      expect(list.body.data.items.map((r: { id: string }) => r.id)).toEqual([v.row.id]);
      expect(workforceResponseSchema("aftercare").safeParse(list.body.data).success).toBe(
        true,
      );
      const detail = await get(who, `/${v.row.id}`);
      expect(detail.status).toBe(200);
      expect(
        workforceResponseSchema("aftercareRequest").safeParse(detail.body.data).success,
      ).toBe(true);
      expect(detail.body.data).toMatchObject({
        id: v.row.id,
        orderId: v.order.id,
        status: "INSPECTED",
        order: { branchId: f.home.id, totalKobo: "30000" },
        policy: { approvalStatus: "APPROVED" },
        requestedItems: [
          {
            orderItemId: v.order.items[0]!.id,
            quantity: 1,
            orderedQuantity: 3,
            productName: "Synthetic product",
          },
        ],
      });
      expect(detail.body.data.reviewRevision).toMatch(/^[a-f0-9]{64}$/);
      const text = JSON.stringify(detail.body.data);
      for (const value of [
        original.customer.user.email,
        original.order.customerPhone,
        "privateDiagnostic",
        "customerId",
        "passwordHash",
      ])
        expect(text).not.toContain(value);
    });
    it("allows a scoped enrolled Admin decision while keeping legacy order access closed and customer history private", async () => {
      const who = await actor({ role: "ADMIN" }),
        v = await record();
      expect((await get(who, `/${v.row.id}`)).status).toBe(200);
      expect(
        (await request(app).get(`/api/v1/staff/orders/${v.order.id}`).set(who.headers))
          .status,
      ).toBe(403);
      expect((await send(who, v.row.id, await body(who, v.row.id))).status).toBe(200);
      const customer = await request(app)
        .get(`/api/v1/customers/orders/${v.order.id}/aftercare`)
        .set(original.customer.headers);
      expect(customer.status).toBe(200);
      expect(customer.body.data).toHaveLength(1);
      expect(customer.body.data[0]).toMatchObject({
        id: v.row.id,
        status: "APPROVED",
        reviewNote: note,
        approvedFeeKobo: "0",
      });
      expect(customer.body.data[0]).not.toHaveProperty("inspectionNote");
      expect(customer.body.data[0]).not.toHaveProperty("policySnapshot");
    });
    it("requires finance responsibility and the separate active decision grant", async () => {
      const v = await record();
      for (const options of [{ grant: false }, { scope: false }]) {
        const who = await actor(options);
        expect((await get(who, "")).status).toBe(403);
        expect((await get(who, `/${v.row.id}`)).status).toBe(403);
        expect(
          (
            await send(who, v.row.id, {
              stage: "APPROVED",
              note,
              approvedFeeKobo: "0",
              expectedStatus: "INSPECTED",
              expectedRevision: "a".repeat(64),
            })
          ).status,
        ).toBe(403);
      }
    });
    it("applies explicit assignment branches to Staff and never restores broad managed Admin inspection", async () => {
      const v = await record({ branchId: f.other.id }),
        admin = await actor({ role: "ADMIN" }),
        staff = await actor();
      expect((await get(admin, `/${v.row.id}`)).status).toBe(404);
      await f.assignment(staff.user.id, "ACCOUNTANT", true, f.other.id);
      expect((await get(staff, `/${v.row.id}`)).status).toBe(200);
      expect((await send(staff, v.row.id, await body(staff, v.row.id))).status).toBe(200);
      await prisma.branch.update({
        where: { id: f.other.id },
        data: { isActive: false },
      });
      expect((await get(staff, `/${v.row.id}`)).status).toBe(404);
      await prisma.branch.update({ where: { id: f.other.id }, data: { isActive: true } });
    });
    it("records one financial decision/audit without creating stock or marking a refund paid", async () => {
      const who = await actor(),
        v = await record(),
        inventory = await prisma.inventory.findUniqueOrThrow({
          where: { id: original.inventory.id },
        }),
        refunds = await prisma.refund.count({
          where: { paymentAttempt: { payment: { orderId: v.order.id } } },
        });
      const sent = await body(who, v.row.id),
        result = await send(who, v.row.id, sent);
      expect(result.status).toBe(200);
      expect(
        workforceResponseSchema("aftercareDecision").safeParse(result.body.data).success,
      ).toBe(true);
      expect(result.body.data).toMatchObject({
        id: v.row.id,
        orderId: v.order.id,
        branchId: f.home.id,
        status: "APPROVED",
        reviewNote: note,
        approvedFeeKobo: "0",
        performedByUserId: who.user.id,
      });
      expect(
        await prisma.inventory.findUnique({ where: { id: original.inventory.id } }),
      ).toEqual(inventory);
      expect(
        await prisma.refund.count({
          where: { paymentAttempt: { payment: { orderId: v.order.id } } },
        }),
      ).toBe(refunds);
      expect(
        await prisma.auditLog.count({
          where: { userId: who.user.id, entityId: v.order.id, action: "UPDATE" },
        }),
      ).toBe(1);
      expect((await send(who, v.row.id, sent)).status).toBe(409);
    });
    it("rejects changed review evidence even while status stays the same", async () => {
      const who = await actor(),
        v = await record(),
        sent = await body(who, v.row.id);
      await prisma.orderAftercareRequest.update({
        where: { id: v.row.id },
        data: { inspectionNote: "Synthetic later inspection correction" },
      });
      expect((await send(who, v.row.id, sent)).status).toBe(409);
      const fresh = await body(who, v.row.id);
      await expect(
        prisma.order.update({
          where: { id: v.order.id },
          data: { totalKobo: 25000n },
        }),
      ).rejects.toThrow("immutable");
      const stored = v.row.policySnapshot;
      if (!stored || typeof stored !== "object" || Array.isArray(stored))
        throw Error("Synthetic policy fixture shape changed");
      await prisma.orderAftercareRequest.update({
        where: { id: v.row.id },
        data: {
          policySnapshot: {
            ...stored,
            settings: { privateDiagnostic: "Synthetic policy correction" },
          },
        },
      });
      expect((await send(who, v.row.id, fresh)).status).toBe(409);
      expect(
        (
          await prisma.orderAftercareRequest.findUniqueOrThrow({
            where: { id: v.row.id },
          })
        ).status,
      ).toBe("INSPECTED");
    });
    it("preserves inspection and explicit fee rules, including free cancellation before confirmation", async () => {
      const who = await actor(),
        pending = await record({ status: "REQUESTED" });
      expect(
        (await send(who, pending.row.id, await body(who, pending.row.id))).status,
      ).toBe(409);
      const v = await record(),
        { approvedFeeKobo: _fee, ...noFee } = await body(who, v.row.id);
      expect((await send(who, v.row.id, noFee)).status).toBe(409);
      expect(
        (
          await send(who, v.row.id, {
            ...(await body(who, v.row.id)),
            approvedFeeKobo: "30001",
          })
        ).status,
      ).toBe(409);
      const free = await record({
        kind: "CANCELLATION",
        status: "REQUESTED",
        confirmed: false,
      });
      expect(
        (
          await send(who, free.row.id, {
            ...(await body(who, free.row.id)),
            approvedFeeKobo: "1",
          })
        ).status,
      ).toBe(409);
      expect((await send(who, free.row.id, await body(who, free.row.id))).status).toBe(
        200,
      );
      expect(
        (
          await send(who, pending.row.id, {
            ...(await body(who, pending.row.id)),
            stage: "REJECTED",
          })
        ).status,
      ).toBe(200);
    });
    it("denies revoked/expired or unassured authority and requires CSRF and strict decision fields", async () => {
      const who = await actor(),
        v = await record(),
        sent = await body(who, v.row.id);
      const pending = await f.session(who.user.id, "STAFF", false);
      expect((await get(pending, `/${v.row.id}`)).status).toBe(403);
      const { "X-CSRF-Token": _csrf, ...headers } = who.headers;
      expect((await send({ headers }, v.row.id, sent)).status).toBe(403);
      for (const invalid of [
        { ...sent, stage: "RECEIVED" },
        { ...sent, unexpected: true },
        { ...sent, expectedRevision: "invalid" },
      ])
        expect((await send(who, v.row.id, invalid)).status).toBe(422);
      await prisma.userCapability.update({
        where: { id: who.grant!.id },
        data: { revokedAt: new Date() },
      });
      expect((await get(who, `/${v.row.id}`)).status).toBe(403);
      expect((await send(who, v.row.id, sent)).status).toBe(403);
      const expired = await actor();
      await prisma.workforceAssignment.updateMany({
        where: { userId: expired.user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await get(expired, "")).status).toBe(403);
    });
    it("keeps malformed legacy evidence visible and preserves database kind/status guards", async () => {
      const who = await actor(),
        v = await record();
      await prisma.orderAftercareRequest.update({
        where: { id: v.row.id },
        data: {
          items: [{ orderItemId: randomUUID(), quantity: 99 }],
          policySnapshot: { legacy: "Unrecognised retained evidence" },
        },
      });
      const detail = await get(who, `/${v.row.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data).toMatchObject({
        requestedItems: null,
        policy: null,
        reviewEvidenceReady: false,
      });
      expect((await send(who, v.row.id, await body(who, v.row.id))).status).toBe(409);
      await expect(
        prisma.orderAftercareRequest.update({
          where: { id: v.row.id },
          data: { kind: "LEGACY_TYPE", status: "LEGACY_STATUS" },
        }),
      ).rejects.toThrow("OrderAftercareRequest_kind_check");
      await expect(
        prisma.orderAftercareRequest.update({
          where: { id: v.row.id },
          data: { status: "LEGACY_STATUS" },
        }),
      ).rejects.toThrow("OrderAftercareRequest_status_check");
    });
    it("serializes scoped and legacy decisions on the same request", async () => {
      const who = await actor(),
        v = await record(),
        sent = await body(who, v.row.id);
      await prisma.userCapability.create({
        data: {
          userId: original.admin.user.id,
          capability: "FINANCE_POLICY_APPROVE",
          grantedByUserId: f.owner.id,
        },
      });
      const results = await Promise.all([
        send(who, v.row.id, sent),
        request(app)
          .post(`/api/v1/staff/order-requests/${v.row.id}/review`)
          .set(original.admin.headers)
          .send({
            stage: "APPROVED",
            note,
            approvedFeeKobo: "0",
            expectedStatus: "INSPECTED",
          }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.auditLog.count({
          where: { entityId: v.order.id, action: "UPDATE" },
        }),
      ).toBe(1);
    });
    it("checks cursor membership, kind/status filters and genuine empty results", async () => {
      const who = await actor(),
        a = await record(),
        b = await record(),
        foreign = await record({ branchId: f.other.id });
      const first = await get(who, "?limit=1&status=INSPECTED");
      expect(first.status).toBe(200);
      expect(first.body.data.items).toHaveLength(1);
      const second = await get(
        who,
        `?limit=1&status=INSPECTED&cursor=${first.body.data.nextCursor}`,
      );
      expect(second.status).toBe(200);
      expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
      for (const cursor of [foreign.row.id, randomUUID()])
        expect((await get(who, `?cursor=${cursor}`)).status).toBe(409);
      const empty = await get(
        who,
        `?q=${encodeURIComponent("No match %_ " + randomUUID())}`,
      );
      expect(empty.status).toBe(200);
      expect(empty.body.data.items).toEqual([]);
      expect([a.row.id, b.row.id]).toContain(first.body.data.items[0].id);
    });
  },
);
