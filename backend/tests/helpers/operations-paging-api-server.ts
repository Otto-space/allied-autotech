import "../setup/environment.js";
import { writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { operationsAccount, operationsJob } from "./operations-paging.js";

if (
  process.env.RUN_OPERATIONS_PAGING_BROWSER_TESTS !== "true" ||
  process.env.RUN_DATABASE_TESTS !== "true" ||
  env.NODE_ENV !== "test" ||
  env.DB_HOST !== "127.0.0.1" ||
  env.DB_NAME !== "allied_operations_paging_20261012_test" ||
  !env.FRONTEND_URL.includes("http://localhost:3000") ||
  env.EMAIL_DELIVERY_ENABLED ||
  env.SMS_DELIVERY_ENABLED ||
  env.PAYSTACK_MODE !== "disabled" ||
  env.MONNIFY_MODE !== "disabled"
)
  throw new Error(
    "Operations paging browser verification requires the isolated loopback test database and disabled providers.",
  );
const file = process.env.OPERATIONS_PAGING_SESSION_FILE;
if (!file || !isAbsolute(file))
  throw new Error("An absolute temporary fixture path is required.");
const fromRepo = relative(resolve(".."), file);
if (!isAbsolute(fromRepo) && fromRepo !== ".." && !fromRepo.startsWith(`..${sep}`))
  throw new Error("Keep synthetic sessions outside the repository.");
const fixtures = [];
for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
  const f = await operationsAccount(role);
  fixtures.push({ role, token: f.token, userId: f.user.id });
}
const jobs = [];
for (const source of ["OUTBOX", "PAYMENT_WEBHOOK"] as const)
  for (let i = 0; i < 27; i++)
    jobs.push(
      await operationsJob(source, undefined, new Date(Date.now() + i), "DEAD_LETTER"),
    );
await writeFile(
  file,
  JSON.stringify(
    { fixtures, jobs: jobs.map((j) => ({ source: j.source, id: j.id })) },
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
  ),
  { mode: 0o600 },
);
const server = createApp().listen(5013, "127.0.0.1", () =>
  console.log("Isolated operations-paging API listening on loopback port 5013."),
);
async function close() {
  server.closeAllConnections();
  server.close();
  await prisma.$disconnect();
}
process.on("SIGINT", () => {
  void close();
});
process.on("SIGTERM", () => {
  void close();
});
