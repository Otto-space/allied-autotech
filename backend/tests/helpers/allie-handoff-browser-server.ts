/** Isolated, provider-off composition of the real reviewed Customer Care API. */
import { access, writeFile, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import "../setup/environment.js";

if (
  process.env.RUN_HANDOFF_BROWSER_TESTS !== "true" ||
  process.env.DB_HOST !== "127.0.0.1" ||
  process.env.DB_PORT !== "63888" ||
  !/^allied_allie_state_20261027_[a-f0-9]{12}_ci$/.test(process.env.DB_NAME ?? "")
)
  throw Error("Explicit isolated handoff browser configuration required");
const sessionFile = process.env.HANDOFF_BROWSER_SESSION_FILE;
if (
  !sessionFile ||
  resolve(dirname(sessionFile)) !== resolve(process.env.TEMP!) ||
  basename(sessionFile) !== "allied-handoff-browser.local.json"
)
  throw Error("Owned temporary handoff session path required");
const stopFile = join(dirname(sessionFile), "allied-handoff-browser.stop");
for (const file of [sessionFile, stopFile])
  if (
    await access(file).then(
      () => true,
      () => false,
    )
  )
    throw Error("Prior handoff browser state requires review");
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
 EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND (c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) OR has_table_privilege(current_user,c.oid,'TRUNCATE')))) AS unsafe FROM pg_roles WHERE rolname=current_user`;
if (!privilege || privilege.unsafe) throw Error("Restricted non-owning runtime required");
const { workforceFixture } = await import("../fixtures/workforce.js");
const f = await workforceFixture();
const branch = await prisma.branch.create({
  data: {
    id: "00000000" + randomUUID().slice(8),
    code: "HFB-" + randomUUID().slice(0, 8),
    name: "SYNTHETIC native handoff workshop",
    address: "Synthetic",
    city: "Test",
    state: "Test",
    isActive: true,
  },
});
const operator = await f.account(null, "STAFF", branch.id);
await prisma.workforceAccess.create({
  data: {
    userId: operator.user.id,
    position: "CUSTOMER_SERVICE",
    updatedByUserId: f.owner.id,
  },
});
for (const template of ["CARE_VIEWER", "CARE_RESPONDER"])
  await prisma.workforceAssignment.create({
    data: {
      userId: operator.user.id,
      template,
      templateVersion: 2,
      scope: "BRANCH",
      branchId: branch.id,
      startsAt: new Date(Date.now() - 1000),
      reason: "Synthetic native handoff duties",
      assignedByUserId: f.owner.id,
    },
  });
const complaint = await prisma.complaint.create({
  data: {
    customerId: f.customer.user.profile!.id,
    branchId: branch.id,
    subject: "SYNTHETIC native handoff complaint",
    description: "Synthetic original complaint",
  },
});
await prisma.supportMessage.create({
  data: {
    complaintId: complaint.id,
    authorUserId: operator.user.id,
    authorType: "STAFF",
    visibility: "INTERNAL",
    kind: "INTERNAL_NOTE",
    body: "SYNTHETIC INTERNAL NOTE NEVER CUSTOMER VISIBLE",
  },
});
const ownSessions = [
  operator,
  f.operations,
  f.mechanical1,
  f.mechanical2,
  f.electrical,
  f.lead,
  f.accountant,
  f.cashier,
  f.sales,
  f.care,
  f.scopedAdmin,
  f.customer,
  f.stranger,
].map((m) => m.record.id);
const inventoryBefore = await prisma.inventory.count(),
  bookingsBefore = await prisma.booking.count();
const { createApp } = await import("../../src/app.js");
const wrapper = express();
wrapper.use((request, response, next) => {
  const handoff =
    request.path === "/api/v1/customers/support/handoff" ||
    request.path === "/api/v1/customers/support/handoff/preview";
  const cancel = request.path.startsWith(
    "/api/v1/customers/support/handoff/drafts/handoff-v1.",
  );
  if (
    !/^(GET|HEAD|OPTIONS)$/.test(request.method) &&
    !(
      (request.method === "POST" && (handoff || request.path === "/api/v1/auth/csrf")) ||
      (request.method === "DELETE" && cancel)
    )
  ) {
    response.status(403).json({
      error: { code: "TEST_BOUNDARY", message: "Synthetic handoff actions only" },
    });
    return;
  }
  next();
});
wrapper.get("/__handoff-test-evidence", async (_request, response) => {
  const enquiries = await prisma.enquiry.findMany({
    where: { customerId: f.customer.user.profile!.id, branchId: branch.id },
    select: { id: true, message: true },
  });
  const publicMessages = await prisma.supportMessage.findMany({
    where: {
      complaintId: complaint.id,
      visibility: "CUSTOMER",
      authorUserId: f.customer.user.id,
    },
    select: { body: true },
  });
  response.setHeader("Cache-Control", "no-store");
  response.json({
    newEnquiryCount: enquiries.length,
    newSummaryPersisted: enquiries.some((e) =>
      e.message.includes("Synthetic native reviewed new handoff"),
    ),
    publicReplyCount: publicMessages.length,
    existingSummaryPersisted: publicMessages.some((m) =>
      m.body.includes("Synthetic native reviewed complaint handoff"),
    ),
    internalMessageCount: await prisma.supportMessage.count({
      where: { complaintId: complaint.id, visibility: "INTERNAL" },
    }),
    inventoryUnchanged: inventoryBefore === (await prisma.inventory.count()),
    bookingsUnchanged: bookingsBefore === (await prisma.booking.count()),
    auditCount: await prisma.auditLog.count({
      where: {
        userId: f.customer.user.id,
        entityId: { in: [...enquiries.map((e) => e.id), complaint.id] },
        entityType: { in: ["ENQUIRY", "COMPLAINT"] },
      },
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
  JSON.stringify({
    customerCookie: f.customer.headers.Cookie,
    operatorCookie: operator.headers.Cookie,
    complaintId: complaint.id,
    branchName: branch.name,
  }),
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Isolated provider-off handoff API ready on loopback:5021; synthetic sessions retained locally only.",
);
let stopping = false;
const timer = setTimeout(() => void stop(), 20 * 60000);
const poll = setInterval(
  () =>
    void access(stopFile).then(
      () => stop(),
      () => undefined,
    ),
  1000,
);
async function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  clearInterval(poll);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.session.updateMany({
    where: { id: { in: ownSessions } },
    data: { revokedAt: new Date() },
  });
  await prisma.$disconnect();
  await unlink(sessionFile!);
  await unlink(stopFile).catch(() => undefined);
  console.log(
    "Isolated handoff API stopped; fixture sessions revoked and local cookie file removed.",
  );
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
