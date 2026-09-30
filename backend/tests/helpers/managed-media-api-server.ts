import "../setup/environment.js";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import express from "express";
import sharp from "sharp";
import { createApp } from "../../src/app.js";
import { createApiRouter } from "../../src/routes/index.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { ProfilePhotoService } from "../../src/modules/customers/profile-photo.service.js";
import { createProfilePhotoRouter } from "../../src/modules/customers/profile-photo.routes.js";
import { GarageMediaService } from "../../src/modules/customers/garage-media.service.js";
import { createGarageMediaRouter } from "../../src/modules/customers/garage-media.routes.js";
import { ServiceMediaService } from "../../src/modules/service-operations/service-media.service.js";
import {
  createServiceMediaRouter,
  createPublicServiceMediaRouter,
} from "../../src/modules/service-operations/service-media.routes.js";
import { MemoryMediaStorage } from "./media-storage.js";

// Test-only executable, excluded from the production build. Never mount these test routes in src.
if (
  process.env.RUN_MANAGED_MEDIA_BROWSER_TESTS !== "true" ||
  process.env.RUN_DATABASE_TESTS !== "true" ||
  env.NODE_ENV !== "test" ||
  env.DB_HOST !== "127.0.0.1" ||
  !env.DB_NAME.endsWith("_test") ||
  env.EMAIL_DELIVERY_ENABLED ||
  env.SMS_DELIVERY_ENABLED ||
  env.PAYSTACK_MODE !== "disabled" ||
  env.MONNIFY_MODE !== "disabled"
) {
  throw new Error(
    "Managed media browser tests require explicit opt-in, a loopback _test database and disabled providers.",
  );
}
if (!env.FRONTEND_URL.includes("http://localhost:3011"))
  throw new Error("Set FRONTEND_URL=http://localhost:3011 for this harness.");
const fixturePath = resolve(
  process.env.BG_DIRECTORY_SESSION_FILE ??
    join(tmpdir(), "allied-bg-browser-sessions.json"),
);
const imagePath = resolve(
  process.env.BG_MEDIA_IMAGE_FILE ?? join(tmpdir(), "allied-bg-photo.png"),
);
for (const output of [fixturePath, imagePath]) {
  const fromRepo = relative(resolve(".."), output);
  if (!isAbsolute(fromRepo) && fromRepo !== ".." && !fromRepo.startsWith(`..${sep}`))
    throw new Error("Keep synthetic session/image output outside the repository.");
}
const sessions: Record<string, string> = {};
const garageIds: Record<string, string> = {};
for (const name of ["ADMIN", "STAFF", "CUSTOMER", "OTHER"] as const) {
  const role = name === "OTHER" ? "CUSTOMER" : name;
  const user = await prisma.user.create({
    data: {
      email: `browser-${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: { firstName: "Ada", lastName: "Browser", phone: "+2348000000000" },
            },
          }
        : {}),
    },
  });
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 4 * 3600000);
  await prisma.session.create({
    data: {
      userId: user.id,
      createdAt: new Date(Date.now() - 1000),
      tokenHash: hashToken("session", token),
      expiresAt,
      idleExpiresAt: expiresAt,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
    },
  });
  sessions[name] = token;
  if (role === "CUSTOMER") {
    const profile = await prisma.customerProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    const vehicle = await prisma.customerVehicle.create({
      data: { customerId: profile.id, make: "Toyota", model: "Corolla", year: 2020 },
    });
    garageIds[name] = vehicle.id;
  }
}
const directoryPrefix = `Browserdemo${randomUUID().replaceAll("-", "")}`;
const ids: string[] = [];
for (let index = 0; index < 30; index++) {
  const profile = await prisma.customerProfile.create({
    data: {
      firstName: directoryPrefix,
      lastName: `Customer ${String(index).padStart(2, "0")}`,
      phone: "+2348000000000",
      user: {
        create: {
          email: `directory-browser-${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic",
          emailVerifiedAt: index % 2 ? null : new Date(),
        },
      },
    },
  });
  ids.push(profile.id);
}
await prisma.customerVehicle.create({
  data: { customerId: ids[0]!, make: "Toyota", model: "Corolla", year: 2020 },
});
await writeFile(
  fixturePath,
  JSON.stringify({ sessions, ids, garageIds, directoryPrefix }),
  { mode: 0o600 },
);
await sharp({ create: { width: 320, height: 320, channels: 3, background: "#e07a38" } })
  .png()
  .toFile(imagePath);
const storage = new MemoryMediaStorage();
const router = express.Router();
router.put(
  "/__test/storage/*key",
  express.raw({ type: () => true, limit: "10mb" }),
  (req, res) => {
    const key = (req.params["key"] as string[]).join("/");
    if (!storage.prepared.some((upload) => upload.key === key)) {
      res.sendStatus(404);
      return;
    }
    storage.objects.set(key, req.body as Buffer);
    res.sendStatus(204);
  },
);
router.use(
  "/customers",
  createProfilePhotoRouter(new ProfilePhotoService(prisma, storage)),
);
router.use(
  "/customers",
  createGarageMediaRouter(new GarageMediaService(prisma, storage)),
);
router.use(
  "/admin/services",
  createServiceMediaRouter(new ServiceMediaService(prisma, storage)),
);
router.use(
  "/public",
  createPublicServiceMediaRouter(new ServiceMediaService(prisma, storage)),
);
router.use(createApiRouter({ checkReadiness: async () => undefined }));
const server = createApp({ apiRouter: router }).listen(5011, "127.0.0.1", () => {
  process.stdout.write(
    `Managed media test API ready on 127.0.0.1:5011. Synthetic fixture file: ${fixturePath}\n`,
  );
});
const stop = () =>
  server.close(() => {
    void prisma.$disconnect().then(() => process.exit(0));
  });
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
