import "../setup/environment.js";
import { randomUUID } from "node:crypto";
import express from "express";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashPassword } from "../../src/common/security/passwords.js";

// Deliberately outside src: this harness must never become a deployed API route.
if (
  process.env.RUN_FRONTEND_DATABASE_TESTS !== "true" ||
  env.NODE_ENV !== "test" ||
  env.DB_HOST !== "127.0.0.1" ||
  env.DB_PORT !== 55432 ||
  env.DB_NAME !== "allied_frontend_test" ||
  env.EMAIL_DELIVERY_ENABLED ||
  env.SMS_DELIVERY_ENABLED ||
  env.PAYSTACK_MODE !== "disabled" ||
  env.MONNIFY_MODE !== "disabled"
)
  throw new Error(
    "The frontend harness requires the explicitly isolated local test database and disabled delivery/providers.",
  );

async function createFixture() {
  const suffix = randomUUID().slice(0, 8);
  const password = `isolated browser passphrase ${suffix}`;
  const passwordHash = await hashPassword(password);
  const branch = await prisma.branch.create({
    data: {
      code: `WEB-${suffix}`,
      name: `Isolated Browser Branch ${suffix}`,
      address: "Test fixture address",
      city: "Port Harcourt",
      state: "Rivers",
    },
  });
  const customer = await prisma.user.create({
    data: {
      email: `browser-${suffix}@example.test`,
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          firstName: "Browser",
          lastName: "Fixture",
          phone: "+2348000000000",
          cart: { create: {} },
        },
      },
    },
  });
  const staff = await prisma.user.create({
    data: {
      email: `browser-staff-${suffix}@example.test`,
      passwordHash,
      role: "STAFF",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      staffProfile: {
        create: { firstName: "Browser", lastName: "Operator", branchId: branch.id },
      },
    },
    include: { staffProfile: true },
  });
  if (!staff.staffProfile) throw new Error("Test staff profile missing");
  const service = await prisma.service.create({
    data: {
      name: `Isolated Browser Service ${suffix}`,
      slug: `isolated-service-${suffix}`,
      pricingType: "FIXED",
      priceKobo: 1005n,
      durationMinutes: 60,
    },
  });
  const startsAt = new Date(Date.now() + 8 * 24 * 3_600_000);
  await prisma.bookingSlot.create({
    data: {
      branchId: branch.id,
      serviceId: service.id,
      staffId: staff.staffProfile.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3_600_000),
    },
  });
  const category = await prisma.category.create({
    data: {
      name: `Isolated Browser Category ${suffix}`,
      slug: `isolated-category-${suffix}`,
    },
  });
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: `Isolated Browser Part ${suffix}`,
      slug: `isolated-part-${suffix}`,
      sku: `WEB-${suffix}`,
      priceKobo: 125000n,
    },
  });
  await prisma.inventory.create({
    data: { branchId: branch.id, productId: product.id, quantity: 5 },
  });

  return {
    email: customer.email,
    password,
    branchId: branch.id,
    serviceId: service.id,
    serviceName: service.name,
    productId: product.id,
    productName: product.name,
  };
}

const harness = express();
harness.post("/__test/fixture", async (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.json(await createFixture());
});
harness.use(createApp({ allowedOrigins: ["http://localhost:3000"] }));
const server = harness.listen(5000, "127.0.0.1", () =>
  console.log("Isolated frontend test API listening on loopback port 5000."),
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
