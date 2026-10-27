import { randomUUID } from "node:crypto";
import { generate } from "otplib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import { issueCsrfToken } from "../../src/common/security/csrf-tokens.js";
import {
  encryptTotpSecret,
  serializeEncryptedEnvelope,
} from "../../src/common/security/mfa-encryption.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { createTotpEnrollment } from "../../src/common/security/totp.js";
import type { Prisma } from "../../src/generated/prisma/client.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { IdentityService } from "../../src/modules/identity/identity.service.js";
import type { SessionIssueResult } from "../../src/modules/identity/identity.types.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

// Cryptographic WebAuthn verification is exercised elsewhere; this fixture
// isolates whether its accepted proof commits with the session rotation.
vi.mock("../../src/common/security/webauthn.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/common/security/webauthn.js")>()),
  verifyWebAuthnAuthentication: async () => ({
    verified: true,
    authenticationInfo: { newCounter: 1 },
  }),
}));

const expiry = () => new Date(Date.now() + 3_600_000);

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "sign-in MFA challenge atomicity",
  () => {
    let passwordHash: string;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      passwordHash = await hashPassword("isolated MFA challenge credential");
    });
    afterAll(() => prisma.$disconnect());

    it.each(["totp", "recovery-code"] as const)(
      "does not spend a %s proof when session rotation fails",
      async (method) => {
        const user = await prisma.user.create({
          data: {
            email: `${randomUUID()}@example.test`,
            passwordHash,
            emailVerifiedAt: new Date(),
          },
        });
        const csrf = issueCsrfToken();
        const session = await prisma.session.create({
          data: {
            userId: user.id,
            tokenHash: hashToken("session", randomUUID()),
            csrfTokenHash: csrf.hash,
            expiresAt: expiry(),
            idleExpiresAt: expiry(),
            mfaRequired: true,
            mfaVerifiedAt: null,
          },
        });
        const enrollment = createTotpEnrollment(user.email);
        const encrypted = encryptTotpSecret(enrollment.secret);
        const factor = await prisma.mfaFactor.create({
          data: {
            userId: user.id,
            type: "TOTP",
            status: "ACTIVE",
            name: "Isolated authenticator",
            encryptedSecret: serializeEncryptedEnvelope(encrypted),
            encryptionKeyId: encrypted.keyId,
            verifiedAt: new Date(),
          },
        });
        const recoveryCode = randomUUID();
        const recovery = await prisma.mfaRecoveryCode.create({
          data: {
            userId: user.id,
            codeHash: hashToken("recovery-code", recoveryCode),
          },
        });
        const input =
          method === "totp"
            ? {
                method,
                factorId: factor.id,
                code: await generate({ secret: enrollment.secret }),
              }
            : { method, code: recoveryCode };
        const service = new IdentityService(prisma);
        type Rotate = (
          account: { id: string; email: string; role: UserRole },
          sessionId: string,
          mfaRequired: boolean,
          mfaVerified: boolean,
          database?: Prisma.TransactionClient,
        ) => Promise<SessionIssueResult>;
        const target = service as unknown as { rotateAuthenticatedSession: Rotate };
        const original = target.rotateAuthenticatedSession;
        const rotation = vi
          .spyOn(target, "rotateAuthenticatedSession")
          .mockImplementationOnce(async (...args) => {
            await original.apply(service, args);
            throw new Error("Synthetic failure after MFA session rotation");
          });
        try {
          await expect(
            service.verifyMfaChallenge(
              user.id,
              { sessionId: session.id, csrfTokenHash: csrf.hash },
              input,
            ),
          ).rejects.toThrow("Synthetic failure after MFA session rotation");
        } finally {
          rotation.mockRestore();
        }
        expect(
          await prisma.session.findUniqueOrThrow({ where: { id: session.id } }),
        ).toMatchObject({ tokenHash: session.tokenHash, mfaVerifiedAt: null });
        expect(
          await prisma.mfaFactor.findUniqueOrThrow({ where: { id: factor.id } }),
        ).toMatchObject({ lastUsedAt: null });
        expect(
          await prisma.mfaRecoveryCode.findUniqueOrThrow({ where: { id: recovery.id } }),
        ).toMatchObject({ usedAt: null });
      },
    );

    it("does not consume a WebAuthn challenge or advance its counter when rotation fails", async () => {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      });
      const csrf = issueCsrfToken();
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken("session", randomUUID()),
          csrfTokenHash: csrf.hash,
          expiresAt: expiry(),
          idleExpiresAt: expiry(),
          mfaRequired: true,
          mfaVerifiedAt: null,
        },
      });
      const credentialId = randomUUID();
      const factor = await prisma.mfaFactor.create({
        data: {
          userId: user.id,
          type: "WEBAUTHN",
          status: "ACTIVE",
          name: "Isolated security key",
          credentialId,
          publicKey: Uint8Array.from([1, 2, 3]),
          signCount: 0n,
          verifiedAt: new Date(),
        },
      });
      const challenge = await prisma.mfaChallenge.create({
        data: {
          userId: user.id,
          sessionId: session.id,
          purpose: "AUTHENTICATION",
          challengeHash: hashToken("webauthn-challenge", randomUUID()),
          expiresAt: expiry(),
        },
      });
      const service = new IdentityService(prisma);
      const target = service as unknown as {
        rotateAuthenticatedSession: (...args: unknown[]) => Promise<SessionIssueResult>;
      };
      const original = target.rotateAuthenticatedSession;
      const rotation = vi
        .spyOn(target, "rotateAuthenticatedSession")
        .mockImplementationOnce(async (...args) => {
          await original.apply(service, args);
          throw new Error("Synthetic failure after MFA session rotation");
        });
      try {
        await expect(
          service.verifyMfaChallenge(
            user.id,
            { sessionId: session.id, csrfTokenHash: csrf.hash },
            { method: "webauthn", response: { id: credentialId } },
          ),
        ).rejects.toThrow("Synthetic failure after MFA session rotation");
      } finally {
        rotation.mockRestore();
      }
      expect(
        await prisma.session.findUniqueOrThrow({ where: { id: session.id } }),
      ).toMatchObject({ tokenHash: session.tokenHash, mfaVerifiedAt: null });
      expect(
        await prisma.mfaChallenge.findUniqueOrThrow({ where: { id: challenge.id } }),
      ).toMatchObject({ usedAt: null });
      expect(
        await prisma.mfaFactor.findUniqueOrThrow({ where: { id: factor.id } }),
      ).toMatchObject({ signCount: 0n, lastUsedAt: null });
    });

    it("lets only one concurrent request spend a recovery code for a session revision", async () => {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      });
      const csrf = issueCsrfToken();
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken("session", randomUUID()),
          csrfTokenHash: csrf.hash,
          expiresAt: expiry(),
          idleExpiresAt: expiry(),
          mfaRequired: true,
          mfaVerifiedAt: null,
        },
      });
      const code = randomUUID();
      const recovery = await prisma.mfaRecoveryCode.create({
        data: { userId: user.id, codeHash: hashToken("recovery-code", code) },
      });
      const service = new IdentityService(prisma);
      const snapshot = { sessionId: session.id, csrfTokenHash: csrf.hash };
      const input = { method: "recovery-code" as const, code };
      const results = await Promise.allSettled([
        service.verifyMfaChallenge(user.id, snapshot, input),
        service.verifyMfaChallenge(user.id, snapshot, input),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected).toMatchObject({ reason: { statusCode: 401 } });
      expect(
        await prisma.mfaRecoveryCode.findUniqueOrThrow({ where: { id: recovery.id } }),
      ).toMatchObject({ usedAt: expect.any(Date) });
      expect(
        await prisma.session.findUniqueOrThrow({ where: { id: session.id } }),
      ).toMatchObject({ mfaVerifiedAt: expect.any(Date) });
    });
  },
);
