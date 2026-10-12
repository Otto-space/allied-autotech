import "../setup/environment.js";
import { writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import {
  reviewSourceCustomer,
  reviewSourceFixtures,
  sourceTargets,
} from "./review-sources.js";

if (
  process.env.RUN_REVIEW_SOURCES_BROWSER_TESTS !== "true" ||
  env.NODE_ENV !== "test" ||
  env.DB_HOST !== "127.0.0.1" ||
  env.DB_NAME !== "allied_profile_revision_20261013_test" ||
  !env.FRONTEND_URL.includes("http://localhost:3000") ||
  env.EMAIL_DELIVERY_ENABLED ||
  env.SMS_DELIVERY_ENABLED ||
  env.PAYSTACK_MODE !== "disabled" ||
  env.MONNIFY_MODE !== "disabled"
)
  throw new Error(
    "Review browser verification requires the isolated loopback test database and disabled providers.",
  );
const file = process.env.REVIEW_SOURCES_SESSION_FILE;
if (!file || !isAbsolute(file))
  throw new Error("An absolute temporary fixture path is required.");
const fromRepo = relative(resolve(".."), file);
if (!isAbsolute(fromRepo) && fromRepo !== ".." && !fromRepo.startsWith(`..${sep}`))
  throw new Error("Keep synthetic sessions outside the repository.");
const owner = await reviewSourceCustomer(),
  fixture = await reviewSourceFixtures(owner.customerId);
const sources = [];
for (const target of sourceTargets) sources.push(await fixture.source(target));
const race = await fixture.source("ORDER");
const paging = await reviewSourceCustomer(),
  pageFixture = await reviewSourceFixtures(paging.customerId);
const pageIds = [];
for (let i = 0; i < 22; i++) pageIds.push((await pageFixture.source("ORDER")).id);
await writeFile(
  file,
  JSON.stringify({
    userId: owner.user.id,
    token: owner.token,
    sources,
    race,
    paging: { token: paging.token, ids: pageIds.sort() },
  }),
  { mode: 0o600 },
);
const server = createApp().listen(5011, "127.0.0.1", () =>
  console.log("Isolated review-source API listening on loopback port 5011."),
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
