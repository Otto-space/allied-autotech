import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { customerAftercareResponse } from "../../src/modules/orders/order-aftercare.schemas.js";
import { testCapability } from "../helpers/owner-policy.js";
import { sessionWindow } from "../helpers/session-window.js";

const app = createApp({ checkReadiness: async () => undefined });
const note = "Synthetic review with an explicit documented basis.";
async function account(
  role: "CUSTOMER" | "STAFF" | "ADMIN",
  branchId?: string,
  assured = true,
) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-test-only",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Synthetic",
                lastName: "Aftercare",
                phone: "+2348000000000",
              },
            },
          }
        : {
            staffProfile: {
              create: {
                firstName: "Synthetic",
                lastName: "Reviewer",
                ...(branchId ? { branchId } : {}),
              },
            },
          }),
    },
    include: { profile: true },
  });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken();
  await prisma.session.create({
    data: {
      createdAt: new Date(Date.now() - 1000),
      userId: user.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      ...sessionWindow(3600000),
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role !== "CUSTOMER" && assured ? new Date() : null,
    },
  });
  return {
    user,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrf,
    },
  };
}
type Account = Awaited<ReturnType<typeof account>>;
const post = (actor: Account, url: string, body: unknown) =>
  request(app).post(`/api/v1${url}`).set(actor.headers).send(body);
const get = (actor: Account, url: string) =>
  request(app).get(`/api/v1${url}`).set(actor.headers);
function customerSafe(value: unknown) {
  expect(customerAftercareResponse.strict().safeParse(value).success).toBe(true);
}
async function fixture() {
  const branch = await prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 8),
      name: "Synthetic aftercare",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const customer = await account("CUSTOMER"),
    staff = await account("STAFF", branch.id),
    admin = await account("ADMIN");
  const category = await prisma.category.create({
    data: { name: "Synthetic", slug: randomUUID() },
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
    data: { branchId: branch.id, productId: product.id, quantity: 12, reserved: 2 },
  });
  const order = await prisma.order.create({
    data: {
      branchId: branch.id,
      customerId: customer.user.profile!.id,
      orderNumber: randomUUID(),
      customerName: "Synthetic customer",
      customerEmail: customer.user.email,
      customerPhone: "+2348000000000",
      subtotalKobo: 30000n,
      totalKobo: 30000n,
      status: "COMPLETED",
      fulfillmentMethod: "COLLECTION",
      createdAt: new Date(Date.now() - 86400000),
      confirmedAt: new Date(Date.now() - 80000000),
      paidAt: new Date(Date.now() - 80000000),
      completedAt: new Date(Date.now() - 3600000),
      items: {
        create: {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 3,
          unitPriceKobo: 10000n,
          subtotalKobo: 30000n,
        },
      },
    },
    include: { items: true },
  });
  const path = `/customers/orders/${order.id}`;
  const body = {
    kind: "RETURN",
    reason: "Synthetic request for one damaged product",
    items: [{ orderItemId: order.items[0]!.id, quantity: 1 }],
  };
  return { branch, customer, staff, admin, inventory, order, path, body };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Order aftercare API boundaries",
  () => {
    afterAll(() => prisma.$disconnect());
    it(
      "validates intake, enforces ownership and CSRF, preserves original duplicates and limits customer data",
      { timeout: 30000 },
      async () => {
        const f = await fixture(),
          other = await account("CUSTOMER");
        expect((await request(app).get(`/api/v1${f.path}/aftercare`)).status).toBe(401);
        expect((await get(other, `${f.path}/aftercare`)).status).toBe(404);
        expect((await post(other, `${f.path}/aftercare`, f.body)).status).toBe(404);
        expect(
          (await post(f.staff, `${f.path}/returns`, { reason: f.body.reason })).status,
        ).toBe(403);
        expect(
          (
            await post(
              {
                ...f.customer,
                headers: { ...f.customer.headers, "X-CSRF-Token": "wrong" },
              },
              `${f.path}/aftercare`,
              f.body,
            )
          ).status,
        ).toBe(403);
        expect(
          (await get(f.customer, "/customers/orders/invalid/aftercare")).status,
        ).toBe(422);
        expect(
          (await post(f.customer, `${f.path}/returns`, { reason: "short" })).status,
        ).toBe(422);
        for (const body of [
          { ...f.body, items: [] },
          { ...f.body, items: [{ ...f.body.items[0], quantity: 1.5 }] },
          { ...f.body, unexpected: true },
        ])
          expect((await post(f.customer, `${f.path}/aftercare`, body)).status).toBe(422);
        for (const items of [
          [{ orderItemId: randomUUID(), quantity: 1 }],
          [{ ...f.body.items[0], quantity: 4 }],
          [...f.body.items, ...f.body.items],
        ])
          expect(
            (await post(f.customer, `${f.path}/aftercare`, { ...f.body, items })).status,
          ).toBe(409);
        const first = await post(f.customer, `${f.path}/aftercare`, f.body);
        expect(first.status).toBe(201);
        customerSafe(first.body.data);
        expect(first.body.data.items).toEqual(f.body.items);
        const duplicates = await Promise.all([
          post(f.customer, `${f.path}/aftercare`, {
            ...f.body,
            reason: "A different synthetic reason should not replace the first",
          }),
          post(f.customer, `${f.path}/returns`, {
            reason: "Synthetic full return must retain the existing partial request",
          }),
        ]);
        for (const duplicate of duplicates) {
          expect(duplicate.status).toBe(201);
          expect(duplicate.body.data).toEqual(first.body.data);
          customerSafe(duplicate.body.data);
        }
        expect(
          await prisma.orderAftercareRequest.count({ where: { orderId: f.order.id } }),
        ).toBe(1);
        const list = await get(f.customer, `${f.path}/aftercare`);
        expect(list.status).toBe(200);
        expect(list.body.data).toEqual([first.body.data]);
        const cancellation = await post(f.customer, `${f.path}/cancel`, {
          expectedVersion: 0,
          reason: "Synthetic order already completed requires review",
        });
        expect(cancellation.status).toBe(200);
        expect(cancellation.body.message).not.toBe("Order cancelled");
        expect(cancellation.body.data.status).toBe("COMPLETED");
        customerSafe(cancellation.body.data.cancellationRequest);
        expect(cancellation.body.data.cancellationRequest.kind).toBe("CANCELLATION");
      },
    );

    it("serializes review stages, requires explicit fees and live grants, and never restocks or pays a refund", async () => {
      const f = await fixture();
      const intake = await post(f.customer, `${f.path}/returns`, {
        reason: f.body.reason,
      });
      expect(intake.status).toBe(201);
      expect(intake.body.data.items).toEqual([
        { orderItemId: f.order.items[0]!.id, quantity: 3 },
      ]);
      const path = `/staff/order-requests/${intake.body.data.id}/review`;
      const receive = { stage: "RECEIVED", note, expectedStatus: "REQUESTED" };
      expect((await post(f.customer, path, receive)).status).toBe(403);
      expect((await post(await account("STAFF"), path, receive)).status).toBe(403);
      expect(
        (await post(await account("STAFF", f.branch.id, false), path, receive)).status,
      ).toBe(403);
      expect((await post(f.staff, path, { ...receive, note: "short" })).status).toBe(422);
      expect(
        (await post(f.staff, path, { ...receive, expectedStatus: "unknown" })).status,
      ).toBe(422);
      expect(
        (await post(f.staff, path, { stage: "APPROVED", note, approvedFeeKobo: "0" }))
          .status,
      ).toBe(403);
      await testCapability(f.admin.user.id, "FINANCE_POLICY_APPROVE");
      expect(
        (await post(f.admin, path, { stage: "APPROVED", note, approvedFeeKobo: "0" }))
          .status,
      ).toBe(409);
      const competing = await Promise.all([
        post(f.staff, path, receive),
        post(f.staff, path, receive),
      ]);
      expect(competing.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        (
          await post(f.staff, path, {
            stage: "INSPECTED",
            note,
            expectedStatus: "REQUESTED",
            goodCondition: true,
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await post(f.staff, path, {
            stage: "INSPECTED",
            note,
            expectedStatus: "RECEIVED",
          })
        ).status,
      ).toBe(409);
      const inspection = await post(f.staff, path, {
        stage: "INSPECTED",
        note,
        expectedStatus: "RECEIVED",
        goodCondition: false,
      });
      expect(inspection.status).toBe(200);
      expect(inspection.body.data.inspectionNote).toBe(note);
      const customerRead = await get(f.customer, `${f.path}/aftercare`);
      customerSafe(customerRead.body.data[0]);
      expect(customerRead.body.data[0].goodCondition).toBe(false);
      expect(
        (await get(f.staff, `/staff/orders/${f.order.id}/aftercare`)).body.data[0]
          .inspectionNote,
      ).toBe(note);
      expect(
        (await get(await account("STAFF"), `/staff/orders/${f.order.id}/aftercare`))
          .status,
      ).toBe(403);
      const approve = { stage: "APPROVED", note, expectedStatus: "INSPECTED" };
      expect((await post(f.admin, path, approve)).status).toBe(409);
      expect(
        (await post(f.admin, path, { ...approve, approvedFeeKobo: "30001" })).status,
      ).toBe(409);
      expect(
        (await post(f.admin, path, { ...approve, approvedFeeKobo: "1.5" })).status,
      ).toBe(422);
      await prisma.userCapability.updateMany({
        where: {
          userId: f.admin.user.id,
          capability: "FINANCE_POLICY_APPROVE",
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      expect(
        (await post(f.admin, path, { ...approve, approvedFeeKobo: "0" })).status,
      ).toBe(403);
      await testCapability(f.admin.user.id, "FINANCE_POLICY_APPROVE");
      const approved = await post(f.admin, path, { ...approve, approvedFeeKobo: "1250" });
      expect(approved.status).toBe(200);
      expect(approved.body.data).toMatchObject({
        status: "APPROVED",
        approvedFeeKobo: "1250",
        reviewNote: note,
      });
      expect((await post(f.admin, path, { stage: "REJECTED", note })).status).toBe(409);
      const final = await get(f.customer, `${f.path}/aftercare`);
      customerSafe(final.body.data[0]);
      expect(final.body.data[0].reviewNote).toBe(note);
      expect(
        await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
      ).toEqual(f.inventory);
      expect(
        await prisma.inventoryTransaction.count({
          where: { inventoryId: f.inventory.id },
        }),
      ).toBe(0);
      expect(
        await prisma.refund.count({
          where: {
            requestedByUserId: {
              in: [f.staff.user.id, f.admin.user.id, f.customer.user.id],
            },
          },
        }),
      ).toBe(0);
      const currentOrder = await prisma.order.findUniqueOrThrow({
        where: { id: f.order.id },
      });
      expect(currentOrder).toMatchObject({
        status: f.order.status,
        paidAt: f.order.paidAt,
        totalKobo: f.order.totalKobo,
      });
      expect(
        await prisma.auditLog.count({
          where: { userId: f.staff.user.id, entityId: f.order.id, action: "UPDATE" },
        }),
      ).toBe(2);
    });

    it("records one-time evidence with a bounded timestamp, branch authorization and exact reference", async () => {
      const f = await fixture(),
        path = `/staff/orders/${f.order.id}/fulfillment-evidence`;
      const body = {
        at: new Date(Date.now() - 1800000).toISOString(),
        reference: "Synthetic signed collection note",
      };
      expect((await post(f.customer, path, body)).status).toBe(403);
      expect((await post(await account("STAFF"), path, body)).status).toBe(403);
      expect(
        (
          await post(
            { ...f.staff, headers: { ...f.staff.headers, "X-CSRF-Token": "wrong" } },
            path,
            body,
          )
        ).status,
      ).toBe(403);
      expect((await post(f.staff, path, { ...body, at: "invalid" })).status).toBe(422);
      expect((await post(f.staff, path, { ...body, reference: "x" })).status).toBe(422);
      for (const at of [
        new Date(Date.now() + 86400000).toISOString(),
        new Date(f.order.createdAt.getTime() - 1).toISOString(),
      ])
        expect((await post(f.staff, path, { ...body, at })).status).toBe(409);
      const result = await post(f.staff, path, body);
      expect(result.status).toBe(200);
      expect(result.body.data).toEqual({
        id: f.order.id,
        fulfillmentEvidenceAt: body.at,
        fulfillmentEvidenceReference: body.reference,
      });
      expect(
        (
          await post(f.staff, path, {
            ...body,
            reference: "Different synthetic reference",
          })
        ).status,
      ).toBe(409);
      const current = await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } });
      expect(current).toMatchObject({
        status: f.order.status,
        paidAt: f.order.paidAt,
        fulfillmentEvidenceReference: body.reference,
      });
    });
  },
);
