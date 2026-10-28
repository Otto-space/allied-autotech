/** Loopback-only real composition harness; restricted isolated DB required.
 * Pre-reserves one to three calls in the SAME approval ledger. No model
 * mocks, business submissions, real data, provider retries or application rollout.
 */
import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import express from "express";
import { z } from "zod";
import { evaluationBudgetAllows } from "../../scripts/allie-evaluation-limits.js";

let input = "";
for await (const chunk of process.stdin) {
  input += String(chunk);
  if (Buffer.byteLength(input) > 8192) throw new Error("Invalid evaluation approval");
}
let decoded: unknown;
try {
  decoded = JSON.parse(input);
} catch {
  throw new Error("Invalid evaluation approval");
}
input = "";
const parsed = z
  .object({
    version: z.literal(1),
    purpose: z.literal("isolated-allie-evaluation"),
    projectLabel: z.string(),
    configuredAt: z.string().datetime(),
    model: z.literal("gpt-6-luna"),
    apiKey: z.string().min(20).max(1000).regex(/^\S+$/),
    maxProviderRequests: z.number().int().min(1).max(120),
    maxEvaluationUsd: z.number().positive().max(100),
  })
  .safeParse(decoded);
decoded = null;
if (!parsed.success) throw new Error("Invalid evaluation approval");
const approval = parsed.data;
const countAt = process.argv.indexOf("--count");
const maxCalls = countAt === -1 ? 3 : Number(process.argv[countAt + 1]);
if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 3)
  throw new Error("Invalid browser evaluation call limit");
if (
  process.env["NODE_ENV"] !== "test" ||
  process.env["RUN_DATABASE_TESTS"] !== "true" ||
  !/^allied_allie_state_20261027_[a-f0-9]{12}_ci$/.test(process.env["DB_NAME"] ?? "") ||
  process.env["DB_HOST"] !== "127.0.0.1" ||
  process.env["DB_PORT"] !== "63888"
)
  throw new Error("Wrong isolated evaluation database");
await import("../setup/environment.js");
Object.assign(process.env, {
  OPENAI_API_KEY: approval.apiKey,
  ALLIE_OPENAI_MODEL: approval.model,
  HELP_LEARN_ENABLED: "true",
  HELP_LEARN_AI_ENABLED: "true",
  HELP_LEARN_GUIDES_ENABLED: "true",
  HELP_LEARN_PRACTICE_ENABLED: "true",
  ALLIE_AI_DAILY_TOKEN_LIMIT: "10000000",
  PUBLIC_LAUNCH_MODE: "browse_enquiries",
  FRONTEND_URL: "http://127.0.0.1:3167",
  CLIENT_IP_SOURCE: "socket",
  EMAIL_DELIVERY_ENABLED: "false",
  SMS_DELIVERY_ENABLED: "false",
  PAYSTACK_MODE: "disabled",
  MONNIFY_MODE: "disabled",
});
const root = join(process.env["LOCALAPPDATA"]!, "AlliedAutoTech", "allie-evaluation");
const lockPath = join(root, "evaluation.lock"),
  lock = await open(lockPath, "wx");
const approvalId = createHash("sha256")
  .update(`${approval.configuredAt}:${approval.projectLabel}:${approval.model}`)
  .digest("hex");
const ledgerPath = join(root, `usage-${approvalId}.json`);
let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let stopPoll: ReturnType<typeof setInterval> | undefined;
const stopFile = join(root, `browser-stop-${process.pid}.local`);
let stopping = false;
const { prisma } = await import("../../src/config/database.js");
async function stop() {
  if (stopping) return;
  stopping = true;
  if (timer) clearTimeout(timer);
  if (stopPoll) clearInterval(stopPoll);
  await new Promise<void>((resolve) =>
    server ? server.close(() => resolve()) : resolve(),
  );
  await prisma.$disconnect();
  await lock.close();
  await unlink(lockPath);
  approval.apiKey = "";
}
try {
  const { assertIsolatedLoopbackDatabase } = await import("./isolated-database.js");
  await assertIsolatedLoopbackDatabase();
  const { verifyDatabaseSchema } =
    await import("../../src/common/database/schema-safety.js");
  await verifyDatabaseSchema(prisma);
  const ledger = z
    .object({
      approvalId: z.string(),
      requests: z.number().int().nonnegative(),
      reservedUsd: z.number().nonnegative(),
      reservations: z.array(
        z.object({ at: z.number(), tokens: z.number().int().positive() }),
      ),
    })
    .parse(JSON.parse(await readFile(ledgerPath, "utf8")));
  // Reserve a full 32k input and 1200 output for each allowed HTTP call.
  // Abort before network if its actual body exceeds the reserved byte bound.
  const reserveEach = (32000 * 0.1 + 1200 * 0.5) / 1e6;
  if (
    ledger.approvalId !== approvalId ||
    !evaluationBudgetAllows(
      ledger.requests + maxCalls - 1,
      ledger.reservedUsd,
      approval.maxProviderRequests,
      approval.maxEvaluationUsd,
      maxCalls * reserveEach,
    )
  )
    throw new Error("Remaining approval cannot admit browser calls");
  ledger.requests += maxCalls;
  ledger.reservedUsd += maxCalls * reserveEach;
  const persist = async () => {
    await writeFile(ledgerPath + ".pending", JSON.stringify(ledger), { flag: "wx" });
    await rename(ledgerPath + ".pending", ledgerPath);
  };
  await persist();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (
      url !== "https://api.openai.com/v1/responses" ||
      typeof init?.body !== "string" ||
      Buffer.byteLength(init.body) + 2048 > 32000 ||
      calls >= maxCalls
    )
      throw new Error("Evaluation egress limit");
    const at = Date.now(),
      tokens = Buffer.byteLength(init.body) + 2048 + 1200;
    ledger.reservations = ledger.reservations.filter((r) => r.at > at - 61000);
    if (
      ledger.reservations.length >= 9 ||
      ledger.reservations.reduce((n, r) => n + r.tokens, 0) + tokens > 54000 ||
      (ledger.reservations.at(-1)?.at ?? 0) > at - 6500
    )
      throw new Error("Evaluation admission requires a later manual attempt");
    calls++;
    ledger.reservations.push({ at, tokens });
    await persist();
    const response = await originalFetch(url, init);
    let usage: unknown;
    try {
      const packet = (await response.clone().json()) as { usage?: unknown };
      const parsedUsage = z
        .object({
          input_tokens: z.number().int().nonnegative(),
          output_tokens: z.number().int().nonnegative(),
          total_tokens: z.number().int().nonnegative(),
        })
        .safeParse(packet.usage);
      if (parsedUsage.success) usage = parsedUsage.data;
    } catch {
      /* No response body or exception text is logged. */
    }
    console.log(
      JSON.stringify({ realProviderCall: calls, status: response.status, usage }),
    );
    return response;
  };
  const { workforceFixture } = await import("../fixtures/workforce.js");
  const fixture = await workforceFixture();
  await writeFile(
    join(root, "browser-sessions.local.json"),
    JSON.stringify({ customer: fixture.customer.headers.Cookie }),
    { mode: 0o600 },
  );
  const { createApp } = await import("../../src/app.js");
  const app = express(),
    address =
      "2001:db8:" +
      randomUUID().replaceAll("-", "").match(/.{4}/g)!.slice(0, 6).join(":");
  app.use((req, res, next) => {
    Object.defineProperty(req, "ip", { value: address });
    // This loopback harness supplies its own synthetic socket identity. Never
    // reinterpret proxy headers as authority or enable Express proxy trust.
    delete req.headers["x-forwarded-for"];
    delete req.headers["x-real-ip"];
    delete req.headers["forwarded"];
    if (
      !/^(GET|HEAD|OPTIONS)$/.test(req.method) &&
      req.path !== "/api/v1/auth/csrf" &&
      !/^\/api\/v1\/(?:public\/)?learning\/assistant\//.test(req.path)
    ) {
      res.status(403).json({ message: "Business submissions disabled in evaluation" });
      return;
    }
    next();
  });
  app.use(createApp({ checkReadiness: async () => undefined, rateLimit: 10000 }));
  server = app.listen(5021, "127.0.0.1", () =>
    console.log(
      JSON.stringify({
        ready: true,
        loopbackPort: 5021,
        maxRealProviderCalls: maxCalls,
        database: process.env["DB_NAME"],
        allBusinessSubmissionsBlocked: true,
      }),
    ),
  );
  server.on("error", () => {
    void stop();
    process.exitCode = 1;
  });
  timer = setTimeout(
    () => {
      void stop();
    },
    15 * 60 * 1000,
  );
  // Local-only cleanup; no web shutdown endpoint or forced process termination.
  stopPoll = setInterval(() => {
    void readFile(stopFile, "utf8")
      .then(async (value) => {
        if (value.trim() !== "stop") return;
        await unlink(stopFile);
        await stop();
      })
      .catch(() => undefined);
  }, 500);
  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });
} catch {
  console.error(
    "Isolated browser evaluation stopped; inspect target/configuration/ledger without exposing secrets.",
  );
  await stop();
  process.exitCode = 1;
}
