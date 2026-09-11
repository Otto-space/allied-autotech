import { z } from "zod";

const seedVersion = "allied-autotech-public-v1";

const executionEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["production", "test"]),
    DEPLOYMENT_ENV: z.literal("staging"),
    CONFIRM_STAGING_PUBLIC_SEED: z.literal(seedVersion),
    DB_NAME: z
      .string()
      .trim()
      .min(1)
      .refine((value) => /staging/i.test(value)),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "test" && !/(?:_test|_ci)$/i.test(value.DB_NAME)) {
      context.addIssue({
        code: "custom",
        path: ["DB_NAME"],
        message: "Test rehearsals require a disposable _test or _ci database",
      });
    }
  });

const executionEnvironment = executionEnvironmentSchema.safeParse(process.env);

if (!executionEnvironment.success) {
  const fields = [
    ...new Set(executionEnvironment.error.issues.map((issue) => issue.path.join("."))),
  ];
  throw new Error(`Staging seed safety check failed: ${fields.join(", ")}`);
}

const branches = [
  {
    code: "STG-LAG-LEKKI",
    name: "[STAGING] Lekki Service Centre",
    phone: null,
    email: null,
    address: "1 Test Drive",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    timezone: "Africa/Lagos",
    isActive: true,
  },
] as const;

const services = [
  {
    name: "[STAGING] Vehicle diagnostics",
    slug: "staging-vehicle-diagnostics",
    description: "Synthetic staging service for validating diagnostic-service discovery.",
    shortDescription: "Synthetic diagnostics listing for integration testing.",
    pricingType: "FIXED" as const,
    priceKobo: 2_500_000n,
    currency: "NGN",
    durationMinutes: 90,
    isActive: true,
    version: 0,
  },
  {
    name: "[STAGING] Routine maintenance",
    slug: "staging-routine-maintenance",
    description:
      "Synthetic staging service for validating routine-maintenance discovery.",
    shortDescription: "Synthetic maintenance listing for integration testing.",
    pricingType: "FIXED" as const,
    priceKobo: 4_500_000n,
    currency: "NGN",
    durationMinutes: 120,
    isActive: true,
    version: 0,
  },
  {
    name: "[STAGING] Body repair assessment",
    slug: "staging-body-repair-assessment",
    description:
      "Synthetic staging service for validating quote-required service discovery.",
    shortDescription: "Synthetic quote-required listing for integration testing.",
    pricingType: "QUOTE_REQUIRED" as const,
    priceKobo: null,
    currency: "NGN",
    durationMinutes: 60,
    isActive: true,
    version: 0,
  },
] as const;

type ComparableValue = bigint | boolean | null | number | string;

function assertRecordMatches(
  kind: string,
  key: string,
  actual: Record<string, unknown>,
  expected: Record<string, ComparableValue>,
): void {
  const mismatchedFields = Object.entries(expected)
    .filter(([field, expectedValue]) => actual[field] !== expectedValue)
    .map(([field]) => field);

  if (mismatchedFields.length > 0) {
    throw new Error(
      `Existing ${kind} ${key} differs from approved staging data: ${mismatchedFields.join(", ")}`,
    );
  }
}

async function seed(): Promise<void> {
  const [{ prisma }, { Prisma }] = await Promise.all([
    import("../src/config/database.js"),
    import("../src/generated/prisma/client.js"),
  ]);

  let createdBranches = 0;
  let createdServices = 0;

  try {
    await prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${seedVersion}))
        `;

        for (const expectedBranch of branches) {
          const existingBranch = await transaction.branch.findUnique({
            where: { code: expectedBranch.code },
          });

          if (existingBranch !== null) {
            assertRecordMatches(
              "branch",
              expectedBranch.code,
              existingBranch,
              expectedBranch,
            );
            continue;
          }

          const branch = await transaction.branch.create({ data: expectedBranch });
          await transaction.auditLog.create({
            data: {
              action: "CREATE",
              entityType: "BRANCH",
              entityId: branch.id,
              requestId: seedVersion,
              newValues: {
                seedVersion,
                code: branch.code,
                synthetic: true,
              },
            },
          });
          createdBranches += 1;
        }

        for (const expectedService of services) {
          const existingService = await transaction.service.findUnique({
            where: { slug: expectedService.slug },
          });

          if (existingService !== null) {
            assertRecordMatches(
              "service",
              expectedService.slug,
              existingService,
              expectedService,
            );
            continue;
          }

          const service = await transaction.service.create({ data: expectedService });
          await transaction.auditLog.create({
            data: {
              action: "CREATE",
              entityType: "SERVICE",
              entityId: service.id,
              requestId: seedVersion,
              newValues: {
                seedVersion,
                slug: service.slug,
                synthetic: true,
              },
            },
          });
          createdServices += 1;
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    console.info(
      `Staging public dataset is ready: ${branches.length} branches and ${services.length} services (${createdBranches + createdServices} created).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await seed();
} catch {
  console.error("Staging public seed failed; no partial seed was committed.");
  process.exitCode = 1;
}
