import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import {
  operationalJobsResponseSchema,
  operationsStatusResponseSchema,
} from "../../src/modules/audit/operations-response.schemas.js";
import { operationsAccount, operationsJob } from "../helpers/operations-paging.js";
const app = createApp({ checkReadiness: async () => undefined });
const path = "/api/v1/admin/operations/jobs";
type Account = Awaited<ReturnType<typeof operationsAccount>>;
// Exact global queue/heartbeat assertions need a separate migrated database.
// Never delete other suites' protected operational evidence to make these pass.
describe.skipIf(
  process.env.RUN_DATABASE_TESTS !== "true" ||
    process.env.RUN_OPERATIONS_PAGING_TESTS !== "true",
)("Operational jobs bounded paging and status contract", () => {
  let administrator: Account;
  const ids: string[] = [];
  beforeEach(async () => {
    administrator = await operationsAccount();
    // Retire fixtures retained by an interrupted previous run on this test database.
    await prisma.paymentWebhookEvent.updateMany({
      where: { eventType: "synthetic.ops.payment_webhook" },
      data: { status: "RECEIVED", lockedAt: null, failedAt: null },
    });
  });
  afterEach(async () => {
    await prisma.outboxEvent.deleteMany({ where: { id: { in: ids } } });
    // Webhook evidence is retained; retire only these synthetic jobs from the queue.
    await prisma.paymentWebhookEvent.updateMany({
      where: { id: { in: ids } },
      data: { status: "RECEIVED", lockedAt: null, failedAt: null },
    });
    ids.length = 0;
  });
  afterAll(() => prisma.$disconnect());
  const read = (query: Record<string, string | number> = {}, actor = administrator) =>
    request(app).get(path).set(actor.headers).query(query);
  async function seed(
    source: "OUTBOX" | "PAYMENT_WEBHOOK",
    id = randomUUID(),
    at = new Date(Date.now() - 60000),
    status: "FAILED" | "DEAD_LETTER" | "PROCESSING" = "FAILED",
  ) {
    ids.push(id);
    return operationsJob(source, id, at, status);
  }
  it("pages both physical queues exactly once with equal timestamps and colliding UUIDs", async () => {
    const at = new Date(Date.now() - 60000),
      created = [];
    for (let i = 0; i < 4; i++) {
      const id = randomUUID();
      for (const source of ["OUTBOX", "PAYMENT_WEBHOOK"] as const)
        created.push(await seed(source, id, at));
    }
    const expected = created
      .sort((a, b) =>
        a.id === b.id ? (a.source < b.source ? 1 : -1) : a.id < b.id ? 1 : -1,
      )
      .map((j) => `${j.source}:${j.id}`);
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 4; page++) {
      const response = await read({ limit: 2, ...(cursor ? { cursor } : {}) });
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      const data = operationalJobsResponseSchema.parse(response.body.data);
      seen.push(...data.items.map((j) => `${j.source}:${j.id}`));
      cursor = data.nextCursor;
      expect(JSON.stringify(response.body)).not.toMatch(
        /PRIVATE-QUEUE-PAYLOAD|PRIVATE-WEBHOOK-PAYLOAD|redactedPayload|payloadSha256|signatureVerifiedAt/,
      );
    }
    expect(seen).toEqual(expected);
    expect(cursor).toBeUndefined();
    expect(
      await prisma.auditLog.count({
        where: {
          userId: administrator.user.id,
          action: "READ",
          newValues: { path: ["resource"], equals: "OPERATIONAL_JOBS" },
        },
      }),
    ).toBe(4);
  });
  it("retains the page boundary after its job is retried or deleted", async () => {
    const now = Date.now(),
      a = await seed("OUTBOX", randomUUID(), new Date(now - 1000)),
      b = await seed("OUTBOX", randomUUID(), new Date(now - 2000)),
      c = await seed("OUTBOX", randomUUID(), new Date(now - 3000));
    const first = await read({ limit: 1, source: "OUTBOX" });
    expect(first.body.data.items[0].id).toBe(a.id);
    const retry = await request(app)
      .post(`${path}/outbox/${a.id}/retry`)
      .set(administrator.headers)
      .send({ expectedAttempts: 3, reason: "Synthetic retry after reconciliation" });
    expect(retry.status).toBe(200);
    const second = await read({
      limit: 1,
      source: "OUTBOX",
      cursor: first.body.data.nextCursor,
    });
    expect(second.body.data.items.map((j: { id: string }) => j.id)).toEqual([b.id]);
    await prisma.outboxEvent.delete({ where: { id: b.id } });
    const third = await read({
      limit: 1,
      source: "OUTBOX",
      cursor: second.body.data.nextCursor,
    });
    expect(third.body.data.items.map((j: { id: string }) => j.id)).toEqual([c.id]);
    expect(third.body.data.nextCursor).toBeUndefined();
  });
  it("binds cursors to source, status and actor, permits page-size changes and rejects tampering/legacy cursors", async () => {
    await seed("OUTBOX");
    await seed("OUTBOX");
    await seed("OUTBOX");
    await seed("PAYMENT_WEBHOOK");
    const first = await read({ limit: 1, source: "OUTBOX", status: "FAILED" });
    expect(first.status).toBe(200);
    const cursor = first.body.data.nextCursor as string;
    expect(cursor).toBeTruthy();
    for (const query of [
      { source: "PAYMENT_WEBHOOK", status: "FAILED" },
      { source: "OUTBOX", status: "DEAD_LETTER" },
      {},
    ])
      expect((await read({ ...query, cursor })).status).toBe(422);
    expect(
      (
        await read(
          { source: "OUTBOX", status: "FAILED", cursor },
          await operationsAccount(),
        )
      ).status,
    ).toBe(422);
    for (const bad of [
      randomUUID(),
      cursor.slice(0, -1) + (cursor.endsWith("0") ? "1" : "0"),
      "x".repeat(1025),
    ])
      expect(
        (await read({ source: "OUTBOX", status: "FAILED", cursor: bad })).status,
      ).toBe(422);
    const second = await read({ limit: 2, source: "OUTBOX", status: "FAILED", cursor });
    expect(second.status).toBe(200);
    expect(second.body.data.items).toHaveLength(2);
    expect(second.body.data.nextCursor).toBeUndefined();
  });
  it("filters each source/status and safely handles an empty final page", async () => {
    const a = await seed(
      "PAYMENT_WEBHOOK",
      randomUUID(),
      new Date(Date.now() - 1000),
      "DEAD_LETTER",
    );
    const b = await seed(
      "PAYMENT_WEBHOOK",
      randomUUID(),
      new Date(Date.now() - 2000),
      "DEAD_LETTER",
    );
    await seed("OUTBOX");
    await seed("PAYMENT_WEBHOOK", randomUUID(), new Date(), "PROCESSING");
    const first = await read({
      source: "PAYMENT_WEBHOOK",
      status: "DEAD_LETTER",
      limit: 1,
    });
    expect(first.body.data.items[0].id).toBe(a.id);
    await prisma.paymentWebhookEvent.update({
      where: { id: b.id },
      data: { status: "RECEIVED", failedAt: null },
    });
    const second = await read({
      source: "PAYMENT_WEBHOOK",
      status: "DEAD_LETTER",
      limit: 1,
      cursor: first.body.data.nextCursor,
    });
    expect(second.body.data).toEqual({ items: [] });
  });
  it("enforces roles, MFA, session revocation and strict query validation", async () => {
    expect((await request(app).get(path)).status).toBe(401);
    for (const role of ["STAFF", "CUSTOMER"] as const)
      expect((await read({}, await operationsAccount(role))).status).toBe(403);
    expect((await read({}, await operationsAccount("ADMIN", false))).status).toBe(403);
    expect((await read({}, await operationsAccount("SUPER_ADMIN"))).status).toBe(200);
    for (const query of [
      { limit: 101 },
      { limit: 0 },
      { source: "UNKNOWN" },
      { status: "PUBLISHED" },
      { branchId: randomUUID() },
    ])
      expect((await read(query)).status).toBe(422);
    await prisma.session.update({
      where: { id: administrator.session.id },
      data: { revokedAt: new Date() },
    });
    expect((await read()).status).toBe(401);
  });
  it("projects missing, overdue and recently successful workers plus bounded unresolved alerts", async () => {
    const names = ["identity-outbox", "notification-delivery", "refunds"],
      old = await prisma.workerHeartbeat.findMany({ where: { name: { in: names } } });
    const alerts = Array.from({ length: 101 }, () => randomUUID()).sort(),
      at = new Date(),
      runId = randomUUID();
    try {
      for (const [i, name] of names.entries())
        await prisma.workerHeartbeat.upsert({
          where: { name },
          create: {
            name,
            lastStartedAt: at,
            lastSucceededAt:
              i === 2 ? null : new Date(at.getTime() - (i === 1 ? 700000 : 1000)),
            lastFailedAt: i === 2 ? at : null,
            errorCode: i === 2 ? "SYNTHETIC_FAILURE" : null,
          },
          update: {
            lastStartedAt: at,
            lastSucceededAt:
              i === 2 ? null : new Date(at.getTime() - (i === 1 ? 700000 : 1000)),
            lastFailedAt: i === 2 ? at : null,
            errorCode: i === 2 ? "SYNTHETIC_FAILURE" : null,
          },
        });
      await prisma.operationalAlert.createMany({
        data: alerts.map((id) => ({
          id,
          key: `paging-${id}`,
          category: "SYNTHETIC",
          message: "Synthetic operational alert",
          createdAt: at,
        })),
      });
      await prisma.paymentReconciliationRun.create({
        data: {
          id: runId,
          provider: "PAYSTACK",
          status: "DIFFERENCES_FOUND",
          periodStart: new Date(at.getTime() - 86400000),
          periodEnd: at,
          differenceCount: 2,
          startedAt: at,
          completedAt: at,
        },
      });
      const response = await request(app)
        .get("/api/v1/admin/operations/status")
        .set(administrator.headers);
      expect(response.status).toBe(200);
      const data = operationsStatusResponseSchema.parse(response.body.data);
      expect(data.lastReconciliation).toMatchObject({
        id: runId,
        status: "DIFFERENCES_FOUND",
        differenceCount: 2,
      });
      expect(data.workers.find((w) => w.name === names[0])).toMatchObject({
        missing: false,
        overdue: false,
      });
      expect(data.workers.find((w) => w.name === names[1])).toMatchObject({
        missing: false,
        overdue: true,
      });
      expect(data.workers.find((w) => w.name === names[2])).toMatchObject({
        missing: false,
        overdue: true,
        lastSucceededAt: null,
      });
      expect(data.workers.find((w) => w.name === "booking-reminders")).toEqual({
        name: "booking-reminders",
        missing: true,
        overdue: true,
        staleAfterMs: 600000,
      });
      expect(data.operationalAlerts.map((a) => a.id)).toEqual(alerts.slice(0, 100));
    } finally {
      await prisma.operationalAlert.deleteMany({ where: { id: { in: alerts } } });
      // Reconciliation evidence is append-only even in test fixtures.
      await prisma.workerHeartbeat.deleteMany({ where: { name: { in: names } } });
      if (old.length) await prisma.workerHeartbeat.createMany({ data: old });
    }
  });
  it("documents and returns the actual private monitoring projection for both administrator roles", async () => {
    for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
      const actor = role === "ADMIN" ? administrator : await operationsAccount(role);
      const result = await request(app)
        .get("/api/v1/admin/operations/status")
        .set(actor.headers);
      expect(result.status).toBe(200);
      expect(result.headers["cache-control"]).toBe("private, no-store");
      const data = operationsStatusResponseSchema.parse(result.body.data);
      expect(data.workers.length).toBeGreaterThanOrEqual(8);
      expect(data.workers.every((w) => (w.missing ? w.overdue : true))).toBe(true);
    }
    for (const role of ["STAFF", "CUSTOMER"] as const)
      expect(
        (
          await request(app)
            .get("/api/v1/admin/operations/status")
            .set((await operationsAccount(role)).headers)
        ).status,
      ).toBe(403);
    expect(
      (
        await request(app)
          .get("/api/v1/admin/operations/status")
          .set(administrator.headers)
          .query({ source: "OUTBOX" })
      ).status,
    ).toBe(422);
  });
});
