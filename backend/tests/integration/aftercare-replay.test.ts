import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import * as audit from "../../src/modules/audit/audit.service.js";
import { account, app, fixture, get } from "../helpers/aftercare.js";
import { customerAftercareResponse } from "../../src/modules/orders/order-aftercare.schemas.js";
const customerSafe = (value: unknown) =>
  expect(
    customerAftercareResponse.extend({ replayed: z.boolean() }).strict().safeParse(value)
      .success,
  ).toBe(true);
import { z } from "zod";
const key = (at = Date.now()) => `aftercare-v1.${at}.${randomUUID()}`;
type Fixture = Awaited<ReturnType<typeof fixture>>;
const scope = (f: Fixture) => `aftercare:${f.order.id}:${f.customer.user.id}`;
const send = (f: Fixture, operation: string, token: string, body: unknown) =>
  request(app)
    .post(`/api/v1${f.path}/${operation}`)
    .set(f.customer.headers)
    .set("Idempotency-Key", token)
    .send(body);
async function effects(f: Fixture) {
  return {
    requests: await prisma.orderAftercareRequest.count({
      where: { orderId: f.order.id },
    }),
    audits: await prisma.auditLog.count({
      where: { entityId: f.order.id, action: "CREATE" },
    }),
    receipts: await prisma.idempotencyRecord.count({ where: { scope: scope(f) } }),
  };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Original aftercare submission recovery",
  () => {
    afterAll(() => prisma.$disconnect());
    afterEach(() => vi.restoreAllMocks());
    for (const operation of ["returns", "aftercare"] as const) {
      const bodyFor = (f: Fixture) =>
        operation === "returns"
          ? { reason: f.body.reason }
          : { ...f.body, kind: "CANCELLATION" };
      it(`${operation}: replays original rejected request beyond latest 100 without financial or inventory effects`, async () => {
        const f = await fixture(),
          token = key(),
          body = bodyFor(f);
        const original = await send(f, operation, token, body);
        expect(original.status).toBe(201);
        customerSafe(original.body.data);
        const alternatePath = {
          ...f,
          path: `/customers/orders/${f.order.id.toUpperCase()}`,
        };
        expect((await send(alternatePath, operation, token, body)).body.data).toEqual({
          ...original.body.data,
          replayed: true,
        });
        expect(original.body.data.replayed).toBe(false);
        await prisma.orderAftercareRequest.update({
          where: { id: original.body.data.id },
          data: {
            status: "REJECTED",
            reviewedAt: new Date(),
            reviewNote: "Synthetic later decision",
          },
        });
        const record = await prisma.orderAftercareRequest.findUniqueOrThrow({
          where: { id: original.body.data.id },
        });
        await prisma.orderAftercareRequest.createMany({
          data: Array.from({ length: 101 }, (_, i) => ({
            orderId: f.order.id,
            customerId: record.customerId,
            kind: record.kind,
            reason: "Synthetic subsequent rejected review",
            status: "REJECTED",
            reviewReason: "Synthetic",
            items: f.body.items,
            policySnapshot: {},
            requestedAt: new Date(Date.now() + i + 1),
          })),
        });
        const before = {
          order: await prisma.order.findUnique({ where: { id: f.order.id } }),
          inventory: await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
          effects: await effects(f),
          refunds: await prisma.refund.count({
            where: { paymentAttempt: { payment: { orderId: f.order.id } } },
          }),
        };
        const history = await get(f.customer, `${f.path}/aftercare`);
        expect(history.body.data).toHaveLength(100);
        expect(history.body.data.some((r: { id: string }) => r.id === record.id)).toBe(
          false,
        );
        const replay = await send(f, operation, token, {
          ...body,
          reason: `  ${body.reason}  `,
        });
        expect(replay.status).toBe(201);
        expect(replay.body.data).toMatchObject({
          id: record.id,
          status: "REJECTED",
          replayed: true,
          reason: body.reason,
        });
        customerSafe(replay.body.data);
        expect({
          order: await prisma.order.findUnique({ where: { id: f.order.id } }),
          inventory: await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
          effects: await effects(f),
          refunds: await prisma.refund.count({
            where: { paymentAttempt: { payment: { orderId: f.order.id } } },
          }),
        }).toEqual(before);
      });
      it(`${operation}: concurrent identical submissions commit one request, audit and receipt`, async () => {
        const f = await fixture(),
          token = key();
        const responses = await Promise.all(
          Array.from({ length: 3 }, () => send(f, operation, token, bodyFor(f))),
        );
        expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
        expect(new Set(responses.map((r) => r.body.data.id)).size).toBe(1);
        expect(responses.filter((r) => !r.body.data.replayed)).toHaveLength(1);
        expect(await effects(f)).toEqual({ requests: 1, audits: 1, receipts: 1 });
      });
      it(`${operation}: rejects changed body, endpoint and foreign ownership`, async () => {
        const f = await fixture(),
          token = key(),
          body = bodyFor(f);
        expect((await send(f, operation, token, body)).status).toBe(201);
        const changed = await send(f, operation, token, {
          ...body,
          reason: "Changed original explanation",
        });
        expect(changed.status).toBe(409);
        expect(changed.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
        const switched = await send(
          f,
          operation === "returns" ? "aftercare" : "returns",
          token,
          operation === "returns" ? f.body : { reason: body.reason },
        );
        expect(switched.status).toBe(409);
        const other = await account("CUSTOMER");
        expect(
          (await send({ ...f, customer: other }, operation, token, body)).status,
        ).toBe(404);
        await prisma.session.updateMany({
          where: { userId: f.customer.user.id },
          data: { revokedAt: new Date() },
        });
        expect((await send(f, operation, token, body)).status).toBe(401);
        expect(await effects(f)).toEqual({ requests: 1, audits: 1, receipts: 1 });
      });
      it(`${operation}: a receipt pointing outside the owned order cannot leak or create a replacement`, async () => {
        const f = await fixture(),
          other = await fixture(),
          token = key();
        expect((await send(f, operation, token, bodyFor(f))).status).toBe(201);
        const foreign = await send(other, operation, key(), bodyFor(other));
        expect(foreign.status).toBe(201);
        await prisma.idempotencyRecord.updateMany({
          where: { scope: scope(f) },
          data: { responseBody: { resourceId: foreign.body.data.id } },
        });
        const response = await send(f, operation, token, bodyFor(f));
        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
        expect(response.body.data).toBeUndefined();
        expect(await effects(f)).toEqual({ requests: 1, audits: 1, receipts: 1 });
      });
      it(`${operation}: expires before and after receipt cleanup and rejects future keys`, async () => {
        const f = await fixture(),
          token = key(Date.now() - 86400001);
        for (const k of [token, key(Date.now() + 120000)]) {
          const result = await send(f, operation, k, bodyFor(f));
          expect(result.status).toBe(409);
          expect(result.body.error.code).toBe("IDEMPOTENCY_EXPIRED");
        }
        expect(await effects(f)).toEqual({ requests: 0, audits: 0, receipts: 0 });
        const live = key(Date.now() - 86400000 + 2500);
        expect((await send(f, operation, live, bodyFor(f))).status).toBe(201);
        await new Promise((resolve) => setTimeout(resolve, 2600));
        expect((await send(f, operation, live, bodyFor(f))).body.error.code).toBe(
          "IDEMPOTENCY_EXPIRED",
        );
        await prisma.idempotencyRecord.deleteMany({ where: { scope: scope(f) } });
        expect((await send(f, operation, live, bodyFor(f))).status).toBe(409);
        expect(await effects(f)).toEqual({ requests: 1, audits: 1, receipts: 0 });
      });
      it(`${operation}: audit failure rolls back intake and receipt, allowing the original retry`, async () => {
        const f = await fixture(),
          token = key();
        vi.spyOn(audit, "appendAuditEvent").mockRejectedValueOnce(
          new Error("Synthetic audit failure"),
        );
        expect((await send(f, operation, token, bodyFor(f))).status).toBe(500);
        expect(await effects(f)).toEqual({ requests: 0, audits: 0, receipts: 0 });
        expect((await send(f, operation, token, bodyFor(f))).status).toBe(201);
        expect(await effects(f)).toEqual({ requests: 1, audits: 1, receipts: 1 });
      });
      it(`${operation}: missing and malformed keys, unauthenticated, wrong role and CSRF requests cannot submit`, async () => {
        const f = await fixture();
        const url = `/api/v1${f.path}/${operation}`;
        expect((await request(app).post(url).send(bodyFor(f))).status).toBe(401);
        expect(
          (await request(app).post(url).set(f.customer.headers).send(bodyFor(f))).status,
        ).toBe(422);
        expect((await send(f, operation, "bad", bodyFor(f))).status).toBe(422);
        expect(
          (await send({ ...f, customer: f.staff }, operation, key(), bodyFor(f))).status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .post(url)
              .set(f.customer.headers)
              .set("X-CSRF-Token", "wrong")
              .set("Idempotency-Key", key())
              .send(bodyFor(f))
          ).status,
        ).toBe(403);
        expect(await effects(f)).toEqual({ requests: 0, audits: 0, receipts: 0 });
      });
    }
  },
);
