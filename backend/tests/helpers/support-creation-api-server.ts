import "../setup/environment.js";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { reviewSourceCustomer } from "./review-sources.js";

if (
  process.env.RUN_SUPPORT_CREATION_BROWSER_TESTS !== "true" ||
  env.NODE_ENV !== "test" ||
  env.DB_HOST !== "127.0.0.1" ||
  env.DB_NAME !== "allied_preferences_20261013_test" ||
  !env.FRONTEND_URL.includes("http://localhost:3000") ||
  env.EMAIL_DELIVERY_ENABLED ||
  env.SMS_DELIVERY_ENABLED ||
  env.PAYSTACK_MODE !== "disabled" ||
  env.MONNIFY_MODE !== "disabled"
)
  throw new Error(
    "Support creation browser verification requires the isolated loopback test database and disabled providers.",
  );
const file = process.env.SUPPORT_CREATION_SESSION_FILE;
if (!file || !isAbsolute(file))
  throw new Error("An absolute temporary fixture path is required.");
const fromRepo = relative(resolve(".."), file);
if (!isAbsolute(fromRepo) && fromRepo !== ".." && !fromRepo.startsWith(`..${sep}`))
  throw new Error("Keep synthetic sessions outside the repository.");
const owner = await reviewSourceCustomer();
const branch = await prisma.branch.create({
  data: {
    code: randomUUID().slice(0, 10),
    name: "000 Support recovery browser",
    address: "Synthetic",
    city: "Lagos",
    state: "Lagos",
  },
});
await writeFile(
  file,
  JSON.stringify({
    userId: owner.user.id,
    customerId: owner.customerId,
    token: owner.token,
    branchId: branch.id,
  }),
  { mode: 0o600 },
);
const server = createApp().listen(5011, "127.0.0.1", () =>
  console.log("Isolated support creation API listening on loopback port 5011."),
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
