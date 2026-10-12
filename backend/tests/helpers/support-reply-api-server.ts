import "../setup/environment.js";
import { writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { supportReplyFixture } from "./support-reply.js";

if (
  process.env.RUN_SUPPORT_REPLY_BROWSER_TESTS !== "true" ||
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
    "Support reply browser verification requires the isolated loopback test database and disabled providers.",
  );
const file = process.env.SUPPORT_REPLY_SESSION_FILE;
if (!file || !isAbsolute(file))
  throw new Error("An absolute temporary fixture path is required.");
const fromRepo = relative(resolve(".."), file);
if (!isAbsolute(fromRepo) && fromRepo !== ".." && !fromRepo.startsWith(`..${sep}`))
  throw new Error("Keep synthetic sessions outside the repository.");
const fixtures = [];
for (const kind of ["enquiry", "complaint"] as const)
  for (const committed of [true, false]) {
    const f = await supportReplyFixture(kind);
    if (committed)
      await prisma.supportMessage.createMany({
        data: Array.from({ length: 60 }, (_, i) => ({
          ...(kind === "enquiry"
            ? { enquiryId: f.recordId }
            : { complaintId: f.recordId }),
          authorType: "SYSTEM",
          visibility: "CUSTOMER",
          body: `Earlier synthetic message ${i + 1}`,
          createdAt: new Date(Date.now() - 120000 + i * 1000),
        })),
      });
    fixtures.push({
      kind,
      committed,
      userId: f.user.id,
      customerId: f.customerId,
      token: f.token,
      recordId: f.recordId,
    });
  }
await writeFile(file, JSON.stringify(fixtures), { mode: 0o600 });
const server = createApp().listen(5011, "127.0.0.1", () =>
  console.log("Isolated support reply API listening on loopback port 5011."),
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
