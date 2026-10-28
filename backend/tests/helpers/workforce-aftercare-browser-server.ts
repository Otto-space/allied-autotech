/** Native browser composition against one explicitly isolated synthetic financial request.
 * No provider, background worker, external delivery or broad operational writes.
 */
import { access, writeFile, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import express from "express";
import { randomUUID } from "node:crypto";
import "../setup/environment.js";

if (
  process.env.RUN_SCOPED_AFTERCARE_BROWSER_TESTS !== "true" ||
  process.env.DB_HOST !== "127.0.0.1" ||
  process.env.DB_PORT !== "63888" ||
  !/^allied_allie_state_20261027_[a-f0-9]{12}_ci$/.test(process.env.DB_NAME ?? "")
)
  throw new Error("Explicit isolated aftercare browser configuration required");
const sessionFile = process.env.WORKFORCE_AFTERCARE_BROWSER_SESSION_FILE;
if (
  !sessionFile ||
  resolve(dirname(sessionFile)) !== resolve(process.env.TEMP!) ||
  basename(sessionFile) !== "allied-workforce-aftercare-browser.local.json"
)
  throw new Error("Use the owned temporary aftercare session path");
const stopFile = join(dirname(sessionFile), "allied-workforce-aftercare-browser.stop");
for (const file of [sessionFile, stopFile]) {
  const exists = await access(file).then(
    () => true,
    () => false,
  );
  if (exists) throw new Error("Prior aftercare browser state needs review before reuse");
}
Object.assign(process.env, {
  HELP_LEARN_AI_ENABLED: "false",
  HELP_AI_ENABLED: "false",
  PUBLIC_LAUNCH_MODE: "browse_enquiries",
  FRONTEND_URL: "http://127.0.0.1:3167",
});
delete process.env.OPENAI_API_KEY;
const { prisma } = await import("../../src/config/database.js");
const { assertIsolatedLoopbackDatabase } = await import("./isolated-database.js");
await assertIsolatedLoopbackDatabase();
const { verifyDatabaseSchema } =
  await import("../../src/common/database/schema-safety.js");
await verifyDatabaseSchema(prisma);
const [privilege] = await prisma.$queryRaw<{ unsafe: boolean }[]>`
  SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR
  EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)) OR
  EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND
    (c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) OR has_table_privilege(current_user,c.oid,'TRUNCATE')))) AS unsafe
  FROM pg_roles WHERE rolname=current_user`;
if (!privilege || privilege.unsafe)
  throw new Error("Restricted non-owning runtime required");
const { fixture } = await import("./aftercare.js");
const f = await fixture();
const owner = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
await prisma.workforceAccess.create({
  data: { userId: f.staff.user.id, position: "ACCOUNTANT", updatedByUserId: owner.id },
});
await prisma.workforceAssignment.create({
  data: {
    userId: f.staff.user.id,
    template: "ACCOUNTANT",
    templateVersion: 1,
    scope: "BRANCH",
    branchId: f.branch.id,
    startsAt: new Date(Date.now() - 1000),
    reason: "Synthetic native browser finance assignment",
    assignedByUserId: owner.id,
  },
});
await prisma.userCapability.create({
  data: {
    userId: f.staff.user.id,
    capability: "FINANCE_POLICY_APPROVE",
    grantedByUserId: owner.id,
  },
});
const browserSession = await prisma.session.findFirstOrThrow({
  where: { userId: f.staff.user.id, revokedAt: null },
});
const aftercare = await prisma.orderAftercareRequest.create({
  data: {
    orderId: f.order.id,
    customerId: f.order.customerId,
    kind: "RETURN",
    status: "INSPECTED",
    reason: "Synthetic native browser request for one damaged item",
    reviewReason: "SYNTHETIC_ONLY",
    items: [{ orderItemId: f.order.items[0].id, quantity: 1 }],
    receivedAt: new Date(),
    inspectedAt: new Date(),
    inspectedByUserId: owner.id,
    inspectionNote: "Internal synthetic evidence stays out of customer note",
    goodCondition: true,
    policySnapshot: {
      id: randomUUID(),
      key: "cancellation",
      version: 1,
      approvalStatus: "APPROVED",
      source: "Synthetic native browser financial policy evidence",
      effectiveAt: new Date(Date.now() - 1000).toISOString(),
      settings: { syntheticOnly: true },
    },
  },
});
const actionPath = `/api/v1/staff/workforce/aftercare/${aftercare.id}/decision`;
const { createApp } = await import("../../src/app.js");
const wrapper = express();
wrapper.use((request, response, next) => {
  if (
    !/^(GET|HEAD|OPTIONS)$/.test(request.method) &&
    !(
      request.method === "POST" &&
      [actionPath, "/api/v1/auth/csrf"].includes(request.path)
    )
  ) {
    response.status(403).json({
      error: { code: "TEST_BOUNDARY", message: "Synthetic financial decision only" },
    });
    return;
  }
  next();
});
// Evidence is a loopback-harness-only projection, never an application route.
wrapper.get("/__aftercare-test-evidence", async (_request, response) => {
  const current = await prisma.orderAftercareRequest.findUniqueOrThrow({
      where: { id: aftercare.id },
    }),
    inventory = await prisma.inventory.findUniqueOrThrow({
      where: { id: f.inventory.id },
    });
  response.setHeader("Cache-Control", "no-store");
  response.json({
    status: current.status,
    reviewed: !!current.reviewedAt,
    fee: current.approvedFeeKobo?.toString() ?? null,
    auditCount: await prisma.auditLog.count({
      where: { userId: f.staff.user.id, entityId: f.order.id, action: "UPDATE" },
    }),
    inventoryUnchanged:
      inventory.quantity === f.inventory.quantity &&
      inventory.reserved === f.inventory.reserved,
    refundCount: await prisma.refund.count({
      where: { paymentAttempt: { payment: { orderId: f.order.id } } },
    }),
  });
});
wrapper.use(createApp({ checkReadiness: async () => undefined, rateLimit: 10000 }));
const server = wrapper.listen(5021, "127.0.0.1");
await new Promise<void>((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});
await writeFile(
  sessionFile,
  JSON.stringify({ cookie: f.staff.headers.Cookie, requestId: aftercare.id }),
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Isolated scoped-aftercare API ready on loopback:5021; synthetic session retained locally only.",
);
let stopping = false;
const timer = setTimeout(() => void stop(), 15 * 60_000);
const poll = setInterval(() => {
  void access(stopFile).then(
    () => stop(),
    () => undefined,
  );
}, 1000);
async function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  clearInterval(poll);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.session.update({
    where: { id: browserSession.id },
    data: { revokedAt: new Date() },
  });
  await prisma.$disconnect();
  await unlink(sessionFile!);
  await unlink(stopFile).catch(() => undefined);
  console.log(
    "Isolated scoped-aftercare API stopped; synthetic session revoked and local cookie removed.",
  );
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
