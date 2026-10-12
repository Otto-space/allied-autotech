import "../setup/environment.js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
assert.equal(process.env.RUN_AFTERCARE_BROWSER_TESTS, "true");
assert.equal(env.DB_HOST, "127.0.0.1");
assert.equal(env.DB_NAME, "allied_preferences_20261013_test");
assert.equal(env.NODE_ENV, "test");
const fixtures = JSON.parse(
  readFileSync(process.env.AFTERCARE_SESSION_FILE!, "utf8"),
) as {
  operation: string;
  committed: boolean;
  orderId: string;
  customerId: string;
  userId: string;
  inventoryId: string;
  order: unknown;
  inventory: unknown;
  items: { orderItemId: string; quantity: number }[];
}[];
const json = (v: unknown) =>
  JSON.parse(
    JSON.stringify(v, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
if (process.argv[2] === "reject") {
  const f = fixtures.find((f) => f.operation === process.argv[3] && f.committed);
  assert.ok(f);
  const record = await prisma.orderAftercareRequest.findFirstOrThrow({
    where: { orderId: f.orderId, customerId: f.customerId },
  });
  await prisma.orderAftercareRequest.update({
    where: { id: record.id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewNote: "Synthetic later rejection",
    },
  });
  await prisma.orderAftercareRequest.createMany({
    data: Array.from({ length: 101 }, (_, i) => ({
      orderId: f.orderId,
      customerId: f.customerId,
      kind: record.kind,
      status: "REJECTED",
      reason: "Synthetic later request",
      reviewReason: "Synthetic",
      items: f.items,
      policySnapshot: {},
      requestedAt: new Date(Date.now() + i + 1),
    })),
  });
  console.log("Synthetic original rejected and placed beyond latest 100 records.");
} else if (process.argv[2] === "verify") {
  for (const f of fixtures) {
    const counts = {
      requests: await prisma.orderAftercareRequest.count({
        where: { orderId: f.orderId },
      }),
      audits: await prisma.auditLog.count({
        where: { entityId: f.orderId, userId: f.userId, action: "CREATE" },
      }),
      receipts: await prisma.idempotencyRecord.count({
        where: { scope: `aftercare:${f.orderId}:${f.userId}` },
      }),
      refunds: await prisma.refund.count({
        where: { paymentAttempt: { payment: { orderId: f.orderId } } },
      }),
    };
    assert.deepEqual(counts, {
      requests: f.committed ? 102 : 1,
      audits: 1,
      receipts: 1,
      refunds: 0,
    });
    assert.deepEqual(
      json(await prisma.order.findUnique({ where: { id: f.orderId } })),
      f.order,
    );
    assert.deepEqual(
      json(await prisma.inventory.findUnique({ where: { id: f.inventoryId } })),
      f.inventory,
    );
    console.log(
      JSON.stringify({ operation: f.operation, committed: f.committed, ...counts }),
    );
  }
} else throw new Error("Unknown synthetic fixture action");
await prisma.$disconnect();
