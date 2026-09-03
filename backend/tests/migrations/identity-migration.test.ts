import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/config/database.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)("Phase 2 identity migration", () => {
  afterAll(async () => prisma.$disconnect());

  it("installs the security constraints and lookup indexes", async () => {
    const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname
      FROM pg_constraint
      WHERE conname = ANY(ARRAY[
        'aat_session_csrf_hash_valid',
        'aat_session_idle_expiry_valid',
        'aat_session_rotation_valid',
        'aat_session_mfa_valid',
        'aat_mfa_challenge_expiry_valid',
        'aat_mfa_challenge_used_valid',
        'aat_auth_throttle_hash_valid',
        'aat_auth_throttle_failures_nonnegative',
        'aat_auth_throttle_expiry_valid',
        'aat_auth_throttle_block_valid'
      ])
    `;
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY(ARRAY[
          'MfaChallenge_challengeHash_key',
          'MfaChallenge_userId_purpose_expiresAt_idx',
          'MfaChallenge_sessionId_purpose_expiresAt_idx',
          'AuthenticationThrottle_keyHash_key',
          'AuthenticationThrottle_blockedUntil_idx',
          'AuthenticationThrottle_expiresAt_idx',
          'Session_idleExpiresAt_idx'
        ])
    `;

    expect(constraints).toHaveLength(10);
    expect(indexes).toHaveLength(7);
  });

  it("contains hashes or ciphertext metadata but no plaintext identity-secret columns", async () => {
    const columns = await prisma.$queryRaw<
      Array<{ table_name: string; column_name: string }>
    >`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'Session',
          'EmailVerificationToken',
          'PasswordResetToken',
          'MfaRecoveryCode',
          'MfaChallenge',
          'AuthenticationThrottle'
        )
    `;
    const names = columns.map(({ column_name }) => column_name.toLowerCase());

    expect(names).toContain("tokenhash");
    expect(names).toContain("csrftokenhash");
    expect(names).toContain("challengehash");
    expect(names).not.toContain("token");
    expect(names).not.toContain("csrftoken");
    expect(names).not.toContain("challenge");
  });
});
