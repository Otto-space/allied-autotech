import "../setup/environment.js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
assert.equal(process.env.RUN_SUPPORT_REPLY_BROWSER_TESTS, "true");
assert.equal(env.DB_HOST, "127.0.0.1");
assert.equal(env.DB_NAME, "allied_preferences_20261013_test");
assert.equal(env.NODE_ENV, "test");
const fixtures = JSON.parse(
  readFileSync(process.env.SUPPORT_REPLY_SESSION_FILE!, "utf8"),
) as {
  kind: "enquiry" | "complaint";
  committed: boolean;
  recordId: string;
  userId: string;
  customerId: string;
}[];
if (process.argv[2] === "close") {
  const f = fixtures.find((f) => f.kind === process.argv[3] && f.committed);
  assert.ok(f);
  const data = {
    status: "CLOSED" as const,
    resolvedAt: new Date(),
    closedAt: new Date(),
    version: { increment: 1 },
  };
  if (f.kind === "enquiry")
    await prisma.enquiry.update({
      where: { id: f.recordId, customerId: f.customerId },
      data,
    });
  else
    await prisma.complaint.update({
      where: { id: f.recordId, customerId: f.customerId },
      data: { ...data, resolution: "Synthetic resolution" },
    });
  console.log("Synthetic conversation closed.");
} else if (process.argv[2] === "verify") {
  for (const f of fixtures) {
    const messages = await prisma.supportMessage.count({
      where: {
        authorUserId: f.userId,
        ...(f.kind === "enquiry"
          ? { enquiryId: f.recordId }
          : { complaintId: f.recordId }),
      },
    });
    const audits = await prisma.auditLog.count({
      where: { entityId: f.recordId, userId: f.userId, action: "CREATE" },
    });
    const receipts = await prisma.idempotencyRecord.count({
      where: { scope: `support-reply:${f.kind}:${f.recordId}:${f.userId}` },
    });
    const notes = await prisma.notification.findMany({
      where: { resourceId: f.recordId },
      select: { id: true },
    });
    const deliveries = await prisma.notificationDelivery.count({
      where: { notificationId: { in: notes.map((n) => n.id) } },
    });
    const outbox = await prisma.outboxEvent.count({
      where: {
        aggregateType: "Notification",
        aggregateId: { in: notes.map((n) => n.id) },
      },
    });
    const counts = {
      messages,
      audits,
      receipts,
      notifications: notes.length,
      deliveries,
      outbox,
    };
    assert.deepEqual(counts, {
      messages: 1,
      audits: 1,
      receipts: 1,
      notifications: 1,
      deliveries: 1,
      outbox: 1,
    });
    console.log(JSON.stringify({ kind: f.kind, committed: f.committed, ...counts }));
  }
} else throw new Error("Unknown synthetic fixture action");
await prisma.$disconnect();
