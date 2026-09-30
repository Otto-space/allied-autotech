import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "customer directory query indexes",
  () => {
    afterAll(async () => prisma.$disconnect());
    it("uses prefix indexes on a representative 5000-customer dataset", async () => {
      const users = Array.from({ length: 5000 }, (_, n) => ({
        id: randomUUID(),
        email: `perf-${randomUUID()}@example.test`,
        passwordHash: "unusable",
        role: "CUSTOMER" as const,
        n,
      }));
      await prisma.user.createMany({ data: users.map(({ n: _n, ...user }) => user) });
      await prisma.customerProfile.createMany({
        data: users.map((user) => ({
          userId: user.id,
          firstName: `Perf${user.n}`,
          lastName: `Sample${user.n}`,
          phone: `999${String(user.n).padStart(7, "0")}`,
        })),
      });
      await prisma.$executeRaw`ANALYZE "CustomerProfile"`;
      await prisma.$executeRaw`ANALYZE "User"`;
      const namePlan =
        await prisma.$queryRaw`EXPLAIN (ANALYZE, FORMAT JSON) SELECT "id" FROM "CustomerProfile" WHERE lower(regexp_replace(trim("firstName" || ' ' || "lastName"), '\\s+', ' ', 'g')) LIKE 'perf4999%' OR lower("lastName") LIKE 'perf4999%'`;
      expect(JSON.stringify(namePlan)).toContain("CustomerProfile_directory_name_idx");
      const phonePlan =
        await prisma.$queryRaw`EXPLAIN (ANALYZE, FORMAT JSON) SELECT "id" FROM "CustomerProfile" WHERE regexp_replace("phone", '[^0-9]', '', 'g') LIKE '9990004999%'`;
      expect(JSON.stringify(phonePlan)).toContain("CustomerProfile_directory_phone_idx");
      const emailPlan =
        await prisma.$queryRaw`EXPLAIN (ANALYZE, FORMAT JSON) SELECT "id" FROM "User" WHERE "role" = 'CUSTOMER' AND lower("email"::text) LIKE 'perf-0000%'`;
      expect(JSON.stringify(emailPlan)).toContain("User_customer_directory_email_idx");
    }, 60_000);
  },
);
