/** Local acceptance harness. Never run against an application database. */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { verifyDatabaseSchema } from "../../src/common/database/schema-safety.js";
import { assertIsolatedLoopbackDatabase } from "./isolated-database.js";
import { workforceFixture } from "../fixtures/workforce.js";
await assertIsolatedLoopbackDatabase();
await verifyDatabaseSchema(prisma);
const fixture = await workforceFixture();
const admin = await fixture.account(null, "ADMIN"),
  owner = await fixture.session(fixture.owner.id, "SUPER_ADMIN");
await writeFile(
  join(
    process.env.LOCALAPPDATA!,
    "AlliedAutoTech/database-verification/help-learn-browser.json",
  ),
  JSON.stringify(
    Object.fromEntries(
      Object.entries({
        customer: fixture.customer,
        care: fixture.care,
        finance: fixture.accountant,
        technician: fixture.mechanical1,
        admin,
        owner,
      }).map(([name, identity]) => [name, identity.headers.Cookie]),
    ),
  ),
  { mode: 0o600 },
);
const server = createApp({
  checkReadiness: async () => undefined,
  rateLimit: 10000,
}).listen(5107, "127.0.0.1", () =>
  console.log(
    "Isolated Help & Learn acceptance API listening on loopback:5107; synthetic fixture cookies stored locally.",
  ),
);
async function stop() {
  server.close();
  await prisma.$disconnect();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
