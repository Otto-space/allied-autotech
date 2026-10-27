/** Native browser composition against one explicitly isolated synthetic booking.
 * No provider, background worker, external delivery or broad operational writes.
 */
import { access, writeFile, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import express from "express";
import "../setup/environment.js";

if (
  process.env.RUN_SCOPED_BOOKING_BROWSER_TESTS !== "true" ||
  process.env.DB_HOST !== "127.0.0.1" ||
  process.env.DB_PORT !== "63888" ||
  !/^allied_allie_state_20261027_[a-f0-9]{12}_ci$/.test(process.env.DB_NAME ?? "")
)
  throw new Error("Explicit isolated booking browser configuration required");
const sessionFile = process.env.WORKFORCE_BOOKING_BROWSER_SESSION_FILE;
if (
  !sessionFile ||
  resolve(dirname(sessionFile)) !== resolve(process.env.TEMP!) ||
  basename(sessionFile) !== "allied-workforce-booking-browser.local.json"
)
  throw new Error("Use the owned temporary booking session path");
const stopFile = join(dirname(sessionFile), "allied-workforce-booking-browser.stop");
for (const file of [sessionFile, stopFile]) {
  const exists = await access(file).then(
    () => true,
    () => false,
  );
  if (exists) throw new Error("Prior booking browser state needs review before reuse");
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
const f = await workforceFixture();
await prisma.userCapability.create({
  data: {
    userId: f.care.user.id,
    capability: "BOOKING_CONFIRM",
    grantedByUserId: f.owner.id,
  },
});
await prisma.businessPolicyVersion.create({
  data: {
    key: `booking-capacity:${f.home.id}`,
    version: 1,
    approvalStatus: "APPROVED",
    source: "Synthetic isolated browser acceptance",
    sourceQuestion: "Test only",
    approvedByUserId: f.owner.id,
    effectiveAt: new Date(Date.now() - 1000),
    settings: {
      dailyLimit: 20,
      openingDays: [0, 1, 2, 3, 4, 5, 6],
      opensAt: "08:00",
      closesAt: "18:00",
      holidays: [],
      timezone: "Africa/Lagos",
    },
  },
});
const scheduledAt = new Date(Date.now() + 15 * 86400000);
scheduledAt.setUTCHours(9, 0, 0, 0);
const booking = await prisma.booking.create({
  data: {
    customerId: f.customer.user.profile!.id,
    branchId: f.home.id,
    assignedStaffId: f.mechanical1.user.staffProfile!.id,
    serviceId: f.job1.serviceId,
    scheduledAt,
    status: "REQUESTED",
  },
});
const actionPath = `/api/v1/staff/workforce/bookings/${booking.id}/confirmation`;
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
    response
      .status(403)
      .json({
        error: { code: "TEST_BOUNDARY", message: "Synthetic booking confirmation only" },
      });
    return;
  }
  next();
});
// Evidence is a loopback-harness-only projection, never an application route.
wrapper.get("/__booking-test-evidence", async (_request, response) => {
  const current = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  response.setHeader("Cache-Control", "no-store");
  response.json({
    status: current.status,
    version: current.version,
    confirmed: !!current.confirmedAt,
    policyRecorded: !!current.capacityPolicyVersionId,
    auditCount: await prisma.auditLog.count({
      where: { userId: f.care.user.id, entityId: booking.id, action: "STATUS_CHANGE" },
    }),
    reminderCount: await prisma.bookingReminder.count({
      where: { bookingId: booking.id, kind: "ONE_HOUR" },
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
  JSON.stringify({ cookie: f.care.headers.Cookie, bookingId: booking.id }),
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Isolated scoped-booking API ready on loopback:5021; synthetic session retained locally only.",
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
    where: { id: f.care.record.id },
    data: { revokedAt: new Date() },
  });
  await prisma.$disconnect();
  await unlink(sessionFile!);
  await unlink(stopFile).catch(() => undefined);
  console.log(
    "Isolated scoped-booking API stopped; synthetic session revoked and local cookie removed.",
  );
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
