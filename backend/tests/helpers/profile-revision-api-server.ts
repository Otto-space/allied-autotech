import "../setup/environment.js";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionWindow } from "./session-window.js";

if (
  process.env.RUN_PROFILE_BROWSER_TESTS !== "true" ||
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
    "Profile browser verification requires the isolated loopback test database and disabled providers.",
  );
const file = process.env.PROFILE_REVISION_SESSION_FILE;
if (!file || !isAbsolute(file))
  throw new Error("An absolute temporary fixture path is required.");
const fromRepo = relative(resolve(".."), file);
if (!isAbsolute(fromRepo) && fromRepo !== ".." && !fromRepo.startsWith(`..${sep}`))
  throw new Error("Keep synthetic sessions outside the repository.");
const user = await prisma.user.create({
  data: {
    email: `${randomUUID()}@example.test`,
    passwordHash: "unusable-synthetic-fixture",
    emailVerifiedAt: new Date(),
    profile: {
      create: {
        firstName: "Amara",
        lastName: "Okafor",
        phone: "08030000000",
        city: "Lagos",
      },
    },
  },
});
const sessions: string[] = [];
for (let i = 0; i < 2; i++) {
  const token = generateOpaqueToken(),
    now = new Date();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", token),
      ...sessionWindow(4 * 3600000),
      createdAt: now,
      lastRotatedAt: now,
    },
  });
  sessions.push(token);
}
await writeFile(file, JSON.stringify({ userId: user.id, sessions }), { mode: 0o600 });
const server = createApp().listen(5011, "127.0.0.1", () =>
  console.log("Isolated profile API listening on loopback port 5011."),
);
async function close() {
  server.closeAllConnections();
  server.close();
  await prisma.$disconnect();
}
process.on("SIGTERM", () => {
  void close();
});
process.on("SIGINT", () => {
  void close();
});
