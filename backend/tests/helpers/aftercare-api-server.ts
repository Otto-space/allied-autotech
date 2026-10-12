import "../setup/environment.js";
import { writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { fixture } from "./aftercare.js";

if (
  process.env.RUN_AFTERCARE_BROWSER_TESTS !== "true" ||
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
    "Aftercare browser verification requires the isolated loopback test database and disabled providers.",
  );
const file = process.env.AFTERCARE_SESSION_FILE;
if (!file || !isAbsolute(file))
  throw new Error("An absolute temporary fixture path is required.");
const fromRepo = relative(resolve(".."), file);
if (!isAbsolute(fromRepo) && fromRepo !== ".." && !fromRepo.startsWith(`..${sep}`))
  throw new Error("Keep synthetic sessions outside the repository.");
const fixtures = [];
for (const operation of ["returns", "aftercare"] as const)
  for (const committed of [true, false]) {
    const f = await fixture();
    fixtures.push({
      operation,
      committed,
      userId: f.customer.user.id,
      customerId: f.customer.user.profile!.id,
      token: f.customer.headers.Cookie.split("=")[1],
      orderId: f.order.id,
      inventoryId: f.inventory.id,
      order: await prisma.order.findUnique({ where: { id: f.order.id } }),
      inventory: f.inventory,
      items: f.body.items,
    });
  }
await writeFile(
  file,
  JSON.stringify(fixtures, (_, value) =>
    typeof value === "bigint" ? value.toString() : value,
  ),
  { mode: 0o600 },
);
const server = createApp().listen(5012, "127.0.0.1", () =>
  console.log("Isolated aftercare API listening on loopback port 5012."),
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
