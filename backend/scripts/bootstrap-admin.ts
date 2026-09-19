import { parseArgs } from "node:util";
import { z } from "zod";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import {
  inspectOwnerCandidate,
  provisionInitialOwner,
} from "../src/modules/organization/owner-provisioning.js";

// Read-only unless the operator supplies --apply and both account identifiers.
let database: PrismaClient | undefined;
async function bootstrap() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean", default: false },
      email: { type: "string" },
      "expected-user-id": { type: "string" },
      apply: { type: "boolean", default: false },
    },
  });
  if (values.help || values.email === undefined) {
    process.stdout.write(
      "Usage (from the project root or backend folder):\n" +
        "  npm run bootstrap:super-admin -- --email <selected-email>\n" +
        "  npm run bootstrap:super-admin -- --email <selected-email> --expected-user-id <verified-account-id> --apply\n\n" +
        "The first command only inspects the existing account. Provisioning requires --apply, both account identifiers, and an active verified account. No account is created or verified by this script.\n",
    );
    return;
  }
  const email = z.email().max(254).parse(values.email);
  const expectedUserId = values.apply
    ? z.uuid().parse(values["expected-user-id"])
    : undefined;
  // Help and argument validation do not require database credentials or a connection.
  const { prisma } = await import("../src/config/database.js");
  database = prisma;
  if (expectedUserId !== undefined) {
    const owner = await provisionInitialOwner(prisma, {
      email,
      expectedUserId,
    });
    process.stdout.write(
      `Selected account ${owner.email} is now the sole owner. Existing sessions were revoked. Sign in and complete MFA before privileged access.\n`,
    );
  } else {
    const { ownerCount, candidate } = await inspectOwnerCandidate(prisma, email);
    process.stdout.write(
      JSON.stringify(
        {
          ownerCount,
          candidate:
            candidate === null
              ? null
              : {
                  id: candidate.id,
                  email: candidate.email,
                  role: candidate.role,
                  active: candidate.status === "ACTIVE",
                  verified: candidate.emailVerifiedAt !== null,
                },
          eligible:
            ownerCount === 0 &&
            candidate?.status === "ACTIVE" &&
            candidate.emailVerifiedAt !== null,
          applied: false,
        },
        null,
        2,
      ) + "\n",
    );
  }
}

try {
  await bootstrap();
} catch {
  // Never print arbitrary SQL errors, connection strings or credentials.
  process.stderr.write(
    "Owner provisioning did not complete. Check the selected account, existing owner, applied migrations and database configuration. No account is auto-created or auto-verified.\n",
  );
  process.exitCode = 1;
} finally {
  await database?.$disconnect();
}
