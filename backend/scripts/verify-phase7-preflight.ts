import { prisma } from "../src/config/database.js";

const checks = [
  {
    name: "multiple live listings for one vehicle",
    sql: `SELECT "vehicleId", count(*)::int AS count
          FROM "VehicleListing"
          WHERE "status" IN ('AVAILABLE', 'RESERVED')
          GROUP BY "vehicleId"
          HAVING count(*) > 1`,
  },
  {
    name: "multiple committed buyers for one listing",
    sql: `SELECT "vehicleListingId", count(*)::int AS count
          FROM "VehicleTransaction"
          WHERE "status" IN ('PAYMENT_PENDING', 'RESERVED', 'PARTIALLY_PAID', 'PAID', 'HANDOVER_PENDING', 'COMPLETED')
          GROUP BY "vehicleListingId"
          HAVING count(*) > 1`,
  },
  {
    name: "multiple primary images for one vehicle",
    sql: `SELECT "vehicleId", count(*)::int AS count
          FROM "VehicleImage"
          WHERE "isPrimary" = true
          GROUP BY "vehicleId"
          HAVING count(*) > 1`,
  },
  {
    name: "reused condition-report object keys",
    sql: `SELECT "reportObjectKey", count(*)::int AS count
          FROM "VehicleConditionReport"
          WHERE "reportObjectKey" IS NOT NULL
          GROUP BY "reportObjectKey"
          HAVING count(*) > 1`,
  },
  {
    name: "reused handover object keys",
    sql: `SELECT "signedDocumentObjectKey", count(*)::int AS count
          FROM "VehicleHandover"
          WHERE "signedDocumentObjectKey" IS NOT NULL
          GROUP BY "signedDocumentObjectKey"
          HAVING count(*) > 1`,
  },
] as const;

let safe = true;

try {
  for (const check of checks) {
    const rows = await prisma.$queryRawUnsafe<unknown[]>(check.sql);
    if (rows.length === 0) {
      process.stdout.write(`PASS: ${check.name}\n`);
      continue;
    }

    safe = false;
    process.stderr.write(`FAIL: ${check.name} (${rows.length} conflicting group(s))\n`);
  }
} finally {
  await prisma.$disconnect();
}

if (!safe) process.exitCode = 1;
