import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/config/database.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)("Phase 3 organization migration", () => {
  afterAll(async () => prisma.$disconnect());

  it("installs constrained, hash-only privileged invitations", async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'PrivilegedInvitation'
    `;
    const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname
      FROM pg_constraint
      WHERE conname = ANY(ARRAY[
        'PrivilegedInvitation_role_check',
        'PrivilegedInvitation_terminal_state_check',
        'PrivilegedInvitation_expiry_check',
        'PrivilegedInvitation_branch_role_check'
      ])
    `;
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY(ARRAY[
          'PrivilegedInvitation_tokenHash_key',
          'PrivilegedInvitation_active_email_key'
        ])
    `;
    const names = columns.map(({ column_name }) => column_name.toLowerCase());
    expect(names).toContain("tokenhash");
    expect(names).not.toContain("token");
    expect(constraints).toHaveLength(4);
    expect(indexes).toHaveLength(2);
  });
});
