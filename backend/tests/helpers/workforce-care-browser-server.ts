/** Native browser composition against two explicitly isolated synthetic Care cases.
 * No provider, background worker, external delivery or broad operational writes.
 */
import { access, writeFile, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import express from "express";
import "../setup/environment.js";

if (
  process.env.RUN_SCOPED_CARE_CASE_BROWSER_TESTS !== "true" ||
  process.env.DB_HOST !== "127.0.0.1" ||
  process.env.DB_PORT !== "63888" ||
  !/^allied_allie_state_20261027_[a-f0-9]{12}_ci$/.test(process.env.DB_NAME ?? "")
)
  throw new Error("Explicit isolated care browser configuration required");
const sessionFile = process.env.WORKFORCE_CARE_BROWSER_SESSION_FILE;
if (
  !sessionFile ||
  resolve(dirname(sessionFile)) !== resolve(process.env.TEMP!) ||
  basename(sessionFile) !== "allied-workforce-care-browser.local.json"
)
  throw new Error("Use the owned temporary care session path");
const stopFile = join(dirname(sessionFile), "allied-workforce-care-browser.stop");
for (const file of [sessionFile, stopFile]) {
  const exists = await access(file).then(
    () => true,
    () => false,
  );
  if (exists) throw new Error("Prior care browser state needs review before reuse");
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

const { workforceFixture } = await import("../fixtures/workforce.js");
const f = await workforceFixture(),
  actor = await f.account(null),
  target = await f.account(null);
const actors = [actor, target];
for (const member of actors) {
  await prisma.staffProfile.update({
    where: { id: member.user.staffProfile!.id },
    data: {
      firstName: "Fixture",
      lastName: member === actor ? "Care Operator" : "Care Responder",
    },
  });
  await prisma.workforceAccess.create({
    data: {
      userId: member.user.id,
      position: "CUSTOMER_SERVICE",
      updatedByUserId: f.owner.id,
    },
  });
  for (const template of [
    "CARE_VIEWER",
    "CARE_RESPONDER",
    ...(member === actor ? ["CARE_ASSIGNER"] : []),
  ])
    await prisma.workforceAssignment.create({
      data: {
        userId: member.user.id,
        template,
        templateVersion: 2,
        scope: "BRANCH",
        branchId: f.home.id,
        startsAt: new Date(Date.now() - 1000),
        reason: "Synthetic native browser Care duties",
        assignedByUserId: f.owner.id,
      },
    });
}
const enquiry = await prisma.enquiry.create({
  data: {
    branchId: f.home.id,
    customerId: f.customer.user.profile!.id,
    type: "GENERAL",
    subject: "SYNTHETIC native general Care case",
    message: "Synthetic question for isolated browser acceptance",
    name: "Synthetic native customer",
    email: f.customer.user.email,
    assignedStaffId: actor.user.staffProfile!.id,
  },
});
const complaint = await prisma.complaint.create({
  data: {
    branchId: f.home.id,
    customerId: f.customer.user.profile!.id,
    subject: "SYNTHETIC native Care complaint",
    description: "Synthetic complaint for isolated browser acceptance",
    name: "Synthetic native customer",
    email: f.customer.user.email,
    assignedStaffId: actor.user.staffProfile!.id,
  },
});
const ownSessions = [
  actor,
  target,
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
].map((member) => member.record.id);
const actionPaths = [
    "/api/v1/staff/workforce/enquiries/" + enquiry.id + "/replies",
    "/api/v1/staff/workforce/complaints/" + complaint.id + "/replies",
  ],
  assignmentPaths = [
    "/api/v1/staff/workforce/enquiries/" + enquiry.id + "/assignment",
    "/api/v1/staff/workforce/complaints/" + complaint.id + "/assignment",
  ];
const inventoryBefore = await prisma.inventory.count(),
  bookingsBefore = await prisma.booking.count();
const { createApp } = await import("../../src/app.js");
const wrapper = express();
wrapper.use((request, response, next) => {
  if (
    !/^(GET|HEAD|OPTIONS)$/.test(request.method) &&
    !(
      (request.method === "POST" &&
        [...actionPaths, "/api/v1/auth/csrf"].includes(request.path)) ||
      (request.method === "PATCH" && assignmentPaths.includes(request.path))
    )
  ) {
    response.status(403).json({
      error: { code: "TEST_BOUNDARY", message: "Synthetic Care case actions only" },
    });
    return;
  }
  next();
});

// This loopback-only test projection is never an application route.
wrapper.get("/__care-test-evidence", async (_request, response) => {
  const e = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } }),
    c = await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } });
  response.setHeader("Cache-Control", "no-store");
  response.json({
    enquiryVersion: e.version,
    complaintVersion: c.version,
    bothAssignedToReviewedTarget:
      e.assignedStaffId === target.user.staffProfile!.id &&
      c.assignedStaffId === target.user.staffProfile!.id,
    branchPreserved: e.branchId === f.home.id && c.branchId === f.home.id,
    publicReplyCount: await prisma.supportMessage.count({
      where: { OR: [{ enquiryId: e.id }, { complaintId: c.id }], visibility: "CUSTOMER" },
    }),
    internalMessageCount: await prisma.supportMessage.count({
      where: { OR: [{ enquiryId: e.id }, { complaintId: c.id }], visibility: "INTERNAL" },
    }),
    auditCount: await prisma.auditLog.count({
      where: { userId: actor.user.id, entityId: { in: [e.id, c.id] }, action: "UPDATE" },
    }),
    inventoryUnchanged: (await prisma.inventory.count()) === inventoryBefore,
    bookingsUnchanged: (await prisma.booking.count()) === bookingsBefore,
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
    cookie: actor.headers.Cookie,
    enquiryId: enquiry.id,
    complaintId: complaint.id,
    targetName: "Fixture Care Responder",
  }),
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Isolated scoped-Care-case API ready on loopback:5021; synthetic session retained locally only.",
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
  await prisma.session.updateMany({
    where: { id: { in: ownSessions } },
    data: { revokedAt: new Date() },
  });
  await prisma.$disconnect();
  await unlink(sessionFile!);
  await unlink(stopFile).catch(() => undefined);
  console.log(
    "Isolated scoped-Care-case API stopped; synthetic session revoked and local cookie removed.",
  );
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
