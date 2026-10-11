import "../setup/environment.js";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { testOwner } from "./owner.js";

if (
  process.env.RUN_DATABASE_TESTS !== "true" ||
  process.env.DB_NAME !== "allied_service_discovery_20261009_test"
)
  throw new Error(
    "Service discovery browser fixture requires its isolated test database",
  );
const prefix = `Browser-${randomUUID().slice(0, 8)}`;
const categories = [];
for (let i = 0; i < 25; i++)
  categories.push(
    await prisma.serviceCategory.create({
      data: {
        name: `${prefix} Category ${String(i).padStart(2, "0")}`,
        slug: `${prefix.toLowerCase()}-${i}`,
      },
    }),
  );
const serviceIds: string[] = [];
for (let i = 0; i < 75; i++) {
  const row = await prisma.service.create({
    data: {
      name: `${prefix} Service ${String(i).padStart(2, "0")}`,
      slug: `${prefix.toLowerCase()}-service-${i}`,
      shortDescription: "Synthetic browser verification",
      categoryId: categories[Math.floor(i / 3)]!.id,
      pricingType: "FIXED",
      priceKobo: 10000n,
      durationMinutes: 30 + i,
    },
  });
  serviceIds.push(row.id);
}
const editable = await prisma.service.findFirstOrThrow({ orderBy: { id: "asc" } });
const owner = await testOwner("unusable-browser-test-password");
const admin = await prisma.user.create({
  data: {
    email: `${prefix.toLowerCase()}@example.test`,
    passwordHash: "unusable-browser-test-password",
    role: "ADMIN",
    status: "ACTIVE",
    emailVerifiedAt: new Date(),
    staffProfile: { create: { firstName: "Discovery", lastName: "Admin" } },
  },
});
const sessions = [];
for (const user of [owner, admin]) {
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken(),
    expiresAt = new Date(Date.now() + 3600000);
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      createdAt: new Date(Date.now() - 1000),
      expiresAt,
      idleExpiresAt: expiresAt,
      mfaRequired: true,
      mfaVerifiedAt: new Date(),
    },
  });
  sessions.push({ role: user.role, token, csrf });
}
const artifact = join(tmpdir(), "allied-service-discovery-browser.json");
await writeFile(
  artifact,
  JSON.stringify({
    prefix,
    categories,
    serviceIds,
    editableServiceId: editable.id,
    sessions,
    cookieName: sessionCookieName,
  }),
  { mode: 0o600 },
);
const server = createApp({ checkReadiness: async () => undefined }).listen(
  5025,
  "127.0.0.1",
  () => process.stdout.write("Service discovery test API listening on 127.0.0.1:5025\n"),
);
async function stop() {
  server.close();
  await prisma.$disconnect();
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
