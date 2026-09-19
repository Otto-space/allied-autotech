// Explicitly enabled loopback-only harness. Never import from production code.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

if (
  process.env["RUN_OVERVIEW_DATABASE_TESTS"] !== "true" ||
  process.env["TEST_DB_NAME"] !== "allied_overview_20260918_test"
)
  throw new Error(
    "Overview browser harness requires its disposable database and explicit flag",
  );
process.env["RUN_DATABASE_TESTS"] = "true";
await import("../setup/environment.js");
const { prisma } = await import("../../src/config/database.js");
const { createApp } = await import("../../src/app.js");
const { generateOpaqueToken, hashToken } =
  await import("../../src/common/security/session-tokens.js");
const { sessionCookieName } = await import("../../src/common/security/cookies.js");
const { testOwner } = await import("./owner.js");
const branch = await prisma.branch.create({
  data: {
    code: `OB-${randomUUID().slice(0, 8)}`,
    name: "Isolated overview workshop",
    address: "Test",
    city: "Test",
    state: "Test",
  },
});
const accounts = [];
for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-synthetic-owner-password")
      : await prisma.user.create({
          data: {
            email: `overview-browser-${randomUUID()}@example.test`,
            passwordHash: "unusable-synthetic-password",
            role,
            emailVerifiedAt: new Date(),
            ...(role === "CUSTOMER"
              ? {
                  profile: {
                    create: {
                      firstName: "Isolated",
                      lastName: "Overview",
                      phone: "+2348000000000",
                    },
                  },
                }
              : {
                  staffProfile: {
                    create: {
                      firstName: "Isolated",
                      lastName: role,
                      branchId: branch.id,
                    },
                  },
                }),
          },
        });
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 3600000);
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
  accounts.push({ role, cookie: { name: sessionCookieName, value: token } });
  if (role === "CUSTOMER") {
    const profile = await prisma.customerProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });
    const service = await prisma.service.create({
      data: {
        name: "Isolated overview diagnostic",
        slug: `overview-browser-${randomUUID()}`,
        pricingType: "QUOTE_REQUIRED",
        durationMinutes: 60,
      },
    });
    await prisma.booking.create({
      data: {
        customerId: profile.id,
        branchId: branch.id,
        serviceId: service.id,
        scheduledAt: new Date(Date.now() + 864000000),
        staffNotes: "Not for the overview",
      },
    });
    await prisma.customerVehicle.create({
      data: { customerId: profile.id, make: "Isolated", model: "Vehicle", year: 2024 },
    });
  }
}
const app = createApp({ checkReadiness: async () => undefined });
const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__test/overview-accounts") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(accounts));
  } else app(req, res);
});
server.listen(5011, "127.0.0.1", () =>
  process.stdout.write("Disposable overview API ready on loopback 5011.\n"),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.closeAllConnections();
    server.close(() => {
      void prisma.$disconnect().then(() => process.exit(0));
    });
  });
