/** Loopback-only browser/API/database composition. Never imported by the app. */
import { access, writeFile, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import "../setup/environment.js";

if (
  process.env.RUN_COVERAGE_BROWSER_TESTS !== "true" ||
  process.env.DB_HOST !== "127.0.0.1" ||
  process.env.DB_PORT !== "63888" ||
  !/^coverage_browser_[a-f0-9]{12}_ci$/.test(process.env.DB_NAME ?? "")
)
  throw new Error("Explicit isolated coverage browser configuration required");
const sessionFile = process.env.COVERAGE_BROWSER_SESSION_FILE;
if (
  !sessionFile ||
  resolve(dirname(sessionFile)) !== resolve(process.env.TEMP!) ||
  basename(sessionFile) !== "allied-coverage-browser.local.json"
)
  throw new Error("Use the owned temporary coverage session path");
const stopFile = join(dirname(sessionFile), "allied-coverage-browser.stop");
for (const file of [sessionFile, stopFile])
  if (
    await access(file).then(
      () => true,
      () => false,
    )
  )
    throw new Error("Prior coverage browser state needs review before reuse");
Object.assign(process.env, {
  HELP_LEARN_AI_ENABLED: "false",
  HELP_AI_ENABLED: "false",
  SUPPORT_LIVE_CHAT_ENABLED: "false",
  PUBLIC_LAUNCH_MODE: "browse_enquiries",
  FRONTEND_URL: "http://127.0.0.1:3171",
});
delete process.env.OPENAI_API_KEY;
const { prisma } = await import("../../src/config/database.js");
const { env } = await import("../../src/config/env.js");
const { assertIsolatedLoopbackDatabase } = await import("./isolated-database.js");
await assertIsolatedLoopbackDatabase();
const { verifyDatabaseSchema } =
  await import("../../src/common/database/schema-safety.js");
await verifyDatabaseSchema(prisma);
const [privilege] = await prisma.$queryRaw<{ unsafe: boolean }[]>`
  SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication OR
  has_database_privilege(current_user,current_database(),'CREATE') OR
  has_schema_privilege(current_user,'public','CREATE') OR
  has_table_privilege(current_user,'public._prisma_migrations','INSERT,UPDATE,DELETE') OR
  EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)) OR
  EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND
    (c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) OR has_table_privilege(current_user,c.oid,'TRUNCATE')))) AS unsafe
  FROM pg_roles WHERE rolname=current_user`;
if (!privilege || privilege.unsafe)
  throw new Error("Restricted non-owning runtime required");
const { hashPassword } = await import("../../src/common/security/passwords.js");
const { generateOpaqueToken, hashToken } =
  await import("../../src/common/security/session-tokens.js");
const { sessionCookieName } = await import("../../src/common/security/cookies.js");
const { testOwner } = await import("./owner.js");
const passwordHash = await hashPassword("Synthetic coverage browser proof 2026!");
const owner = await testOwner(passwordHash);
const sessions: string[] = [];
async function session(userId: string) {
  const token = generateOpaqueToken(),
    expires = new Date(Date.now() + 3_600_000);
  const row = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", token),
      createdAt: new Date(),
      expiresAt: expires,
      idleExpiresAt: expires,
      mfaRequired: true,
      mfaVerifiedAt: new Date(),
    },
  });
  sessions.push(row.id);
  return `${sessionCookieName}=${token}`;
}
async function member(role: "ADMIN" | "STAFF") {
  const user = await prisma.user.create({
    data: {
      email: `coverage-${randomUUID()}@example.test`,
      role,
      passwordHash,
      emailVerifiedAt: new Date(),
      staffProfile: {
        create: { firstName: "Fixture", lastName: role, branchId: home.id },
      },
    },
  });
  return session(user.id);
}
async function branch(name: string) {
  return prisma.branch.create({
    data: {
      code: `CB-${randomUUID().slice(0, 8)}`,
      name,
      address: "Synthetic test address",
      city: "Test",
      state: "Test",
    },
  });
}
const home = await branch("Fixture empty support branch");
const other = await branch("Fixture populated support branch");
await prisma.supportLiveCoverage.create({
  data: {
    branchId: other.id,
    enabled: true,
    version: 7,
    maxConcurrentPerAgent: 2,
    schedule: {
      timezone: "Africa/Lagos",
      windows: [{ day: 6, startMinute: 1337, endMinute: 1440 }],
    },
    updatedByUserId: owner.id,
  },
});
const identity = {
  cookie: await session(owner.id),
  staffCookie: await member("STAFF"),
  adminCookie: await member("ADMIN"),
  home: home.id,
  other: other.id,
};
const before = {
  inventory: await prisma.inventory.count(),
  bookings: await prisma.booking.count(),
  messages: await prisma.supportMessage.count(),
};
const coveragePath = `/api/v1/admin/workforce/support-chat/coverage/${home.id}`;
let puts = 0,
  recoveryReads = 0,
  cancellations = 0,
  droppedSaved = false,
  droppedUnsaved = false;
const wrapper = express();
wrapper.use((req, res, next) => {
  if (
    !/^(GET|HEAD|OPTIONS)$/.test(req.method) &&
    !(
      (req.method === "POST" && req.path === "/api/v1/auth/csrf") ||
      (req.method === "PUT" && req.path === coveragePath) ||
      (req.method === "DELETE" && req.path.startsWith(coveragePath + "/operations/"))
    )
  ) {
    res.status(403).json({ error: { code: "TEST_BOUNDARY" } });
    return;
  }
  if (req.method === "GET" && req.path.startsWith(coveragePath + "/operations/"))
    recoveryReads++;
  if (req.method === "DELETE" && req.path.startsWith(coveragePath + "/operations/"))
    cancellations++;
  if (req.method === "PUT" && req.path === coveragePath) {
    puts++;
    if (puts === 3) {
      droppedUnsaved = true;
      req.socket.destroy();
      return;
    }
    if (puts === 2) {
      const end = res.end.bind(res);
      res.end = ((...args: Parameters<typeof res.end>) => {
        if (res.statusCode === 200) {
          droppedSaved = true;
          res.socket?.destroy();
          return res;
        }
        return end(...args);
      }) as typeof res.end;
    }
  }
  next();
});
wrapper.get("/__coverage-test-evidence", async (_req, res) => {
  const row = await prisma.supportLiveCoverage.findUnique({
    where: { branchId: home.id },
  });
  const receipts = await prisma.idempotencyRecord.findMany({
    where: {
      scope: `support-coverage:${owner.id}`,
      responseBody: { path: ["resourceId"], equals: home.id },
    },
    select: { responseBody: true },
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({
    puts,
    recoveryReads,
    cancellations,
    droppedSaved,
    droppedUnsaved,
    version: row?.version ?? 0,
    policyEnabled: row?.enabled ?? false,
    auditCount: await prisma.auditLog.count({
      where: { userId: owner.id, entityId: home.id },
    }),
    receipts: receipts.map((r) => Object.keys(r.responseBody as object).sort()).sort(),
    inventoryUnchanged: (await prisma.inventory.count()) === before.inventory,
    bookingsUnchanged: (await prisma.booking.count()) === before.bookings,
    messagesUnchanged: (await prisma.supportMessage.count()) === before.messages,
    liveEnabled: env.SUPPORT_LIVE_CHAT_ENABLED,
    optedInRepresentatives: await prisma.supportLivePresence.count({
      where: { available: true },
    }),
    otherVersion: (
      await prisma.supportLiveCoverage.findUniqueOrThrow({
        where: { branchId: other.id },
      })
    ).version,
  });
});
const { createApp } = await import("../../src/app.js");
wrapper.use(
  createApp({
    checkReadiness: async () => undefined,
    rateLimit: 10000,
    trustProxyHops: 1,
  }),
);
const server = wrapper.listen(5021, "127.0.0.1");
await new Promise<void>((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});
await writeFile(sessionFile, JSON.stringify(identity), { flag: "wx", mode: 0o600 });
console.log(
  "Isolated coverage API ready on loopback:5021; synthetic cookies kept locally only.",
);
let stopping = false;
const timer = setTimeout(() => void stop(), 15 * 60_000);
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
    where: { id: { in: sessions } },
    data: { revokedAt: new Date() },
  });
  await prisma.$disconnect();
  await unlink(sessionFile!);
  await unlink(stopFile).catch(() => undefined);
  console.log(
    "Coverage harness stopped; its synthetic sessions revoked and cookie file removed.",
  );
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
