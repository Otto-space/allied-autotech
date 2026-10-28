import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import { issueCsrfToken } from "../../src/common/security/csrf-tokens.js";
import { hashPassword, verifyPassword } from "../../src/common/security/passwords.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import type { Prisma } from "../../src/generated/prisma/client.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { IdentityRepository } from "../../src/modules/identity/identity.repository.js";
import { IdentityService } from "../../src/modules/identity/identity.service.js";
import type { SessionIssueResult } from "../../src/modules/identity/identity.types.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

const oldPassword = "isolated original credential for password change";
const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function fixture(oldHash: string) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: oldHash,
      emailVerifiedAt: new Date(),
    },
  });
  const csrf = issueCsrfToken();
  const expiry = new Date(Date.now() + 3_600_000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", randomUUID()),
      csrfTokenHash: csrf.hash,
      createdAt: new Date(Date.now() - 1000),
      expiresAt: expiry,
      idleExpiresAt: expiry,
      mfaRequired: false,
    },
  });
  const other = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", randomUUID()),
      csrfTokenHash: issueCsrfToken().hash,
      createdAt: new Date(Date.now() - 1000),
      expiresAt: expiry,
      idleExpiresAt: expiry,
      mfaRequired: false,
    },
  });
  const reset = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("password-reset", randomUUID()),
      expiresAt: expiry,
    },
  });
  return {
    user,
    session,
    other,
    reset,
    snapshot: { sessionId: session.id, csrfTokenHash: csrf.hash },
  };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "password change transaction and session boundary",
  () => {
    let oldHash: string;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      oldHash = await hashPassword(oldPassword);
    });
    afterAll(() => prisma.$disconnect());

    it("rolls back the credential, revocations and audit when session rotation fails", async () => {
      const f = await fixture(oldHash);
      const service = new IdentityService(prisma);
      type Rotate = (
        user: { id: string; email: string; role: UserRole },
        sessionId: string,
        mfaRequired: boolean,
        mfaVerified: boolean,
        database: Prisma.TransactionClient,
      ) => Promise<SessionIssueResult>;
      const target = service as unknown as { rotateAuthenticatedSession: Rotate };
      const original = target.rotateAuthenticatedSession;
      const rotation = vi
        .spyOn(target, "rotateAuthenticatedSession")
        .mockImplementationOnce(async (...args) => {
          await original.apply(service, args);
          throw new Error("Synthetic failure after session rotation");
        });
      try {
        await expect(
          service.changePassword(
            f.user.id,
            f.snapshot,
            {
              currentPassword: oldPassword,
              newPassword: "isolated new credential after failed rotation",
            },
            context(),
          ),
        ).rejects.toThrow("Synthetic failure after session rotation");
      } finally {
        rotation.mockRestore();
      }
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } }),
      ).toMatchObject({
        passwordHash: oldHash,
        passwordChangedAt: null,
      });
      expect(
        await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } }),
      ).toMatchObject({
        tokenHash: f.session.tokenHash,
        csrfTokenHash: f.session.csrfTokenHash,
        revokedAt: null,
      });
      expect(
        await prisma.session.findUniqueOrThrow({ where: { id: f.other.id } }),
      ).toMatchObject({
        revokedAt: null,
      });
      expect(
        await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: f.reset.id } }),
      ).toMatchObject({ revokedAt: null });
      expect(
        await prisma.auditLog.count({
          where: { entityType: "USER", entityId: f.user.id },
        }),
      ).toBe(0);
      expect(
        await prisma.notification.count({
          where: { userId: f.user.id, category: "SECURITY" },
        }),
      ).toBe(0);
    });

    it("allows only one concurrent change from the same credential and session snapshot", async () => {
      const f = await fixture(oldHash);
      const service = new IdentityService(prisma);
      const held = gate();
      const resume = gate();
      const original = IdentityRepository.prototype.findUserPassword;
      const read = vi
        .spyOn(IdentityRepository.prototype, "findUserPassword")
        .mockImplementationOnce(async function (this: IdentityRepository, id: string) {
          const value = await original.call(this, id);
          held.release();
          await resume.promise;
          return value;
        });
      const stale = service.changePassword(
        f.user.id,
        f.snapshot,
        { currentPassword: oldPassword, newPassword: "isolated losing new credential" },
        context(),
      );
      try {
        await held.promise;
        const winningPassword = "isolated winning new credential";
        const winner = await service.changePassword(
          f.user.id,
          f.snapshot,
          { currentPassword: oldPassword, newPassword: winningPassword },
          context(),
        );
        expect(winner.rawToken).toBeTruthy();
        resume.release();
        await expect(stale).rejects.toMatchObject({ statusCode: 401 });
        const current = await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } });
        expect(await verifyPassword(current.passwordHash, winningPassword)).toBe(true);
        expect(await verifyPassword(current.passwordHash, oldPassword)).toBe(false);
        expect(
          await prisma.session.findUniqueOrThrow({ where: { id: f.session.id } }),
        ).not.toMatchObject({ tokenHash: f.session.tokenHash });
        expect(
          await prisma.session.findUniqueOrThrow({ where: { id: f.other.id } }),
        ).toMatchObject({ revokedAt: expect.any(Date) });
        expect(
          await prisma.passwordResetToken.findUniqueOrThrow({
            where: { id: f.reset.id },
          }),
        ).toMatchObject({ revokedAt: expect.any(Date) });
        expect(
          await prisma.auditLog.count({
            where: { entityType: "USER", entityId: f.user.id },
          }),
        ).toBe(1);
        expect(
          await prisma.notification.count({
            where: { userId: f.user.id, category: "SECURITY" },
          }),
        ).toBe(1);
      } finally {
        resume.release();
        read.mockRestore();
      }
    });
  },
);
