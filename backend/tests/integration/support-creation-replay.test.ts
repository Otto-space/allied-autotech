import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import * as audit from "../../src/modules/audit/audit.service.js";
import * as deadlines from "../../src/modules/support/complaint-sla.js";
import { reviewSourceCustomer } from "../helpers/review-sources.js";
import {
  supportCreationSources,
  supportCreationKey as key,
} from "../helpers/support-creation.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "durable customer support creation",
  () => {
    let app = createApp();
    beforeEach(() => {
      app = createApp();
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(() => prisma.$disconnect());
    type Customer = Awaited<ReturnType<typeof reviewSourceCustomer>>;
    type Kind = "enquiries" | "complaints";
    const post = (f: Customer, kind: Kind, body: unknown, k = key()) =>
      request(app)
        .post(`/api/v1/customers/support/${kind}`)
        .set("Cookie", f.cookie)
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", f.csrf)
        .set("Idempotency-Key", k)
        .send(body);
    const counts = async (f: Customer, kind: Kind) => ({
      records:
        kind === "enquiries"
          ? await prisma.enquiry.count({ where: { customerId: f.customerId } })
          : await prisma.complaint.count({ where: { customerId: f.customerId } }),
      audits: await prisma.auditLog.count({
        where: {
          userId: f.user.id,
          entityType: kind === "enquiries" ? "ENQUIRY" : "COMPLAINT",
          action: "CREATE",
        },
      }),
      receipts: await prisma.idempotencyRecord.count({
        where: { scope: `support-create:${kind}:${f.user.id}` },
      }),
    });
    const common = { subject: "Original support request" };
    const enquiryFields = {
      GENERAL: null,
      PRODUCT: "productId",
      SERVICE: "serviceId",
      VEHICLE: "vehicleListingId",
      BOOKING: "bookingId",
      QUOTATION: "quoteId",
    } as const;
    for (const type of Object.keys(enquiryFields) as (keyof typeof enquiryFields)[])
      it(`${type} enquiry: normalized replay keeps one record after branch/source changes`, async () => {
        const f = await reviewSourceCustomer(),
          sources = await supportCreationSources(f.customerId),
          field = enquiryFields[type],
          k = key();
        const body = {
          ...common,
          type,
          message: "Original details",
          branchId: sources.branchId,
          ...(field ? { [field]: sources[field] } : {}),
        };
        const initial = await post(f, "enquiries", body, k);
        expect(initial.status).toBe(201);
        expect(initial.body.data.replayed).toBe(false);
        await prisma.branch.update({
          where: { id: sources.branchId },
          data: { isActive: false },
        });
        await prisma.enquiry.update({
          where: { id: initial.body.data.id },
          data: {
            status: "CLOSED",
            resolvedAt: new Date(),
            closedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await prisma.supportMessage.create({
          data: {
            enquiryId: initial.body.data.id,
            authorType: "SYSTEM",
            visibility: "INTERNAL",
            body: "PRIVATE_INTERNAL_SENTINEL",
          },
        });
        const replay = await post(
          f,
          "enquiries",
          Object.fromEntries(
            Object.entries({
              ...body,
              subject: ` ${body.subject} `,
              message: ` ${body.message} `,
            }).reverse(),
          ),
          k,
        );
        expect(replay.status).toBe(201);
        expect(replay.body.data).toMatchObject({
          id: initial.body.data.id,
          status: "CLOSED",
          replayed: true,
        });
        expect(replay.headers["cache-control"]).toContain("no-store");
        expect(replay.body.data.messages).toBeUndefined();
        for (const name of ["customerId", "email", "phone", "name", "customer"])
          expect(replay.body.data[name]).toBeUndefined();
        expect(JSON.stringify(replay.body)).not.toContain("PRIVATE_INTERNAL_SENTINEL");
        expect((await post(f, "enquiries", body)).status).toBeGreaterThanOrEqual(400);
        expect(await counts(f, "enquiries")).toEqual({
          records: 1,
          audits: 1,
          receipts: 1,
        });
      });
    for (const field of [null, "bookingId", "orderId", "vehicleTransactionId"] as const)
      it(`${field ?? "GENERAL"} complaint: recovery preserves deadline policy and current state`, async () => {
        const f = await reviewSourceCustomer(),
          sources = await supportCreationSources(f.customerId),
          k = key();
        const body = {
          ...common,
          description: "Original complaint",
          branchId: sources.branchId,
          ...(field ? { [field]: sources[field] } : {}),
        };
        const assign = vi.spyOn(deadlines, "assignComplaintDeadline");
        const initial = await post(f, "complaints", body, k);
        expect(initial.status).toBe(201);
        const before = await prisma.complaint.findUniqueOrThrow({
          where: { id: initial.body.data.id },
        });
        await prisma.branch.update({
          where: { id: sources.branchId },
          data: { isActive: false },
        });
        await prisma.complaint.update({
          where: { id: before.id },
          data: {
            status: "CLOSED",
            closedAt: new Date(),
            resolution: "Current customer resolution",
            version: { increment: 1 },
          },
        });
        const replay = await post(f, "complaints", body, k);
        expect(replay.status).toBe(201);
        expect(replay.body.data).toMatchObject({
          id: before.id,
          status: "CLOSED",
          resolution: "Current customer resolution",
          replayed: true,
        });
        expect(assign).toHaveBeenCalledTimes(1);
        const after = await prisma.complaint.findUniqueOrThrow({
          where: { id: before.id },
        });
        expect(after.slaPolicySnapshot).toEqual(before.slaPolicySnapshot);
        expect(after.acknowledgementDueAt).toEqual(before.acknowledgementDueAt);
        for (const name of [
          "customerId",
          "email",
          "phone",
          "name",
          "slaPolicySnapshot",
          "messages",
        ])
          expect(replay.body.data[name]).toBeUndefined();
        expect(await counts(f, "complaints")).toEqual({
          records: 1,
          audits: 1,
          receipts: 1,
        });
      });
    for (const kind of ["enquiries", "complaints"] as const) {
      async function setup() {
        const f = await reviewSourceCustomer(),
          sources = await supportCreationSources(f.customerId);
        return {
          f,
          body: {
            ...common,
            branchId: sources.branchId,
            ...(kind === "enquiries"
              ? { type: "GENERAL", message: "Original details" }
              : { description: "Original details" }),
          },
        };
      }
      it(`${kind}: concurrent original requests create once`, async () => {
        const { f, body } = await setup(),
          k = key();
        const replies = await Promise.all([
          post(f, kind, body, k),
          post(f, kind, body, k),
          post(f, kind, body, k),
        ]);
        expect(replies.map((r) => r.status)).toEqual([201, 201, 201]);
        expect(new Set(replies.map((r) => r.body.data.id)).size).toBe(1);
        expect(replies.filter((r) => !r.body.data.replayed)).toHaveLength(1);
        expect(await counts(f, kind)).toEqual({ records: 1, audits: 1, receipts: 1 });
      });
      it(`${kind}: changed content conflicts, scopes and receipt ownership cannot cross accounts`, async () => {
        const { f, body } = await setup(),
          other = await reviewSourceCustomer(),
          k = key();
        await post(f, kind, body, k);
        const changed = await post(f, kind, { ...body, subject: "Changed" }, k);
        expect(changed.status).toBe(409);
        expect(changed.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
        const foreign = await post(other, kind, body, k);
        expect(foreign.status).toBe(201);
        expect(foreign.body.data.replayed).toBe(false);
        const receipt = await prisma.idempotencyRecord.findFirstOrThrow({
          where: { scope: `support-create:${kind}:${f.user.id}` },
        });
        await prisma.idempotencyRecord.update({
          where: { id: receipt.id },
          data: { responseBody: { resourceId: foreign.body.data.id } },
        });
        expect((await post(f, kind, body, k)).body.error.code).toBe(
          "IDEMPOTENCY_CONFLICT",
        );
        expect(await counts(f, kind)).toEqual({ records: 1, audits: 1, receipts: 1 });
      });
      it(`${kind}: audit failure rolls back creation and receipt`, async () => {
        const { f, body } = await setup(),
          k = key();
        const fail = vi
          .spyOn(audit, "appendAuditEvent")
          .mockRejectedValueOnce(new Error("Synthetic failure"));
        expect((await post(f, kind, body, k)).status).toBe(500);
        expect(await counts(f, kind)).toEqual({ records: 0, audits: 0, receipts: 0 });
        fail.mockRestore();
        expect((await post(f, kind, body, k)).status).toBe(201);
        expect((await post(f, kind, body, k)).body.data.replayed).toBe(true);
        expect(await counts(f, kind)).toEqual({ records: 1, audits: 1, receipts: 1 });
      });
      it(`${kind}: expired keys fail before and after receipt cleanup and future keys fail`, async () => {
        const { f, body } = await setup(),
          k = key(Date.now() - 86400001);
        await prisma.idempotencyRecord.create({
          data: {
            scope: `support-create:${kind}:${f.user.id}`,
            userId: f.user.id,
            keyHash: createHash("sha256").update(k).digest("hex"),
            requestHash: createHash("sha256").update("expired").digest("hex"),
            createdAt: new Date(Date.now() - 86400001),
            status: "COMPLETED",
            responseStatus: 201,
            completedAt: new Date(Date.now() - 86400000),
            responseBody: { resourceId: randomUUID() },
            expiresAt: new Date(Date.now() - 1),
          },
        });
        expect((await post(f, kind, body, k)).body.error.code).toBe(
          "IDEMPOTENCY_EXPIRED",
        );
        await prisma.idempotencyRecord.deleteMany({
          where: {
            scope: `support-create:${kind}:${f.user.id}`,
            expiresAt: { lt: new Date() },
          },
        });
        expect((await post(f, kind, body, k)).body.error.code).toBe(
          "IDEMPOTENCY_EXPIRED",
        );
        expect(
          (await post(f, kind, body, key(Date.now() + 120000))).body.error.code,
        ).toBe("IDEMPOTENCY_EXPIRED");
        expect(await counts(f, kind)).toEqual({ records: 0, audits: 0, receipts: 0 });
      });
      it(`${kind}: authentication, CSRF, required key and strict body remain enforced`, async () => {
        const { f, body } = await setup(),
          url = `/api/v1/customers/support/${kind}`;
        expect((await request(app).post(url).send(body)).status).toBe(401);
        expect(
          (
            await request(app)
              .post(url)
              .set("Cookie", f.cookie)
              .set("Origin", "http://localhost:3000")
              .send(body)
          ).status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .post(url)
              .set("Cookie", f.cookie)
              .set("Origin", "http://localhost:3000")
              .set("X-CSRF-Token", f.csrf)
              .send(body)
          ).status,
        ).toBe(422);
        expect((await post(f, kind, body, "invalid")).status).toBe(422);
        expect((await post(f, kind, { ...body, customerId: randomUUID() })).status).toBe(
          422,
        );
        expect(await counts(f, kind)).toEqual({ records: 0, audits: 0, receipts: 0 });
      });
    }
  },
);
