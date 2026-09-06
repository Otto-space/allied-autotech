import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../generated/prisma/client.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { UserRole } from "../../generated/prisma/enums.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { issueCsrfToken } from "../../common/security/csrf-tokens.js";
import {
  decryptTotpSecret,
  encryptIdentityPayload,
  encryptTotpSecret,
  parseEncryptedEnvelope,
  serializeEncryptedEnvelope,
} from "../../common/security/mfa-encryption.js";
import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "../../common/security/passwords.js";
import { generateRecoveryCodes } from "../../common/security/recovery-codes.js";
import { generateOpaqueToken, hashToken } from "../../common/security/session-tokens.js";
import { normalizeEmail } from "../../common/security/email.js";
import { createTotpEnrollment, verifyTotp } from "../../common/security/totp.js";
import {
  createWebAuthnAuthenticationOptions,
  createWebAuthnRegistrationOptions,
  verifyWebAuthnAuthentication,
  verifyWebAuthnRegistration,
} from "../../common/security/webauthn.js";
import {
  identityConflict,
  invalidAuthentication,
  invalidToken,
} from "./identity.errors.js";
import { identityEventTypes } from "./identity.events.js";
import { identityRequiresMfa, mayRemoveFinalMfaFactor } from "./identity.policy.js";
import { IdentityRepository } from "./identity.repository.js";
import type {
  ChangePasswordInput,
  LoginInput,
  MfaChallengeVerifyInput,
  RegisterInput,
} from "./identity.schemas.js";
import type {
  IdentityEmailPayload,
  RequestSecurityContext,
  SessionIssueResult,
} from "./identity.types.js";

const genericAcceptedMessage =
  "If the account is eligible, instructions will be sent shortly";

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function safeUserAgent(value: string | null): string | null {
  return value === null ? null : value.slice(0, 512);
}

function createFragmentLink(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}

export class IdentityService {
  private readonly repository: IdentityRepository;

  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new IdentityRepository(database);
  }

  async register(input: RegisterInput, context: RequestSecurityContext): Promise<string> {
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const existing = await this.database.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing !== null) return genericAcceptedMessage;

    const rawToken = generateOpaqueToken();
    const expiresAt = addSeconds(new Date(), env.EMAIL_VERIFICATION_TTL_SECONDS);
    const encryptedPayload = encryptIdentityPayload({
      template: "verify-email",
      to: email,
      link: createFragmentLink(env.FRONTEND_VERIFY_EMAIL_URL, rawToken),
    } satisfies IdentityEmailPayload);

    try {
      await this.database.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            role: "CUSTOMER",
            profile: {
              create: {
                firstName: input.firstName,
                lastName: input.lastName,
                phone: input.phone,
              },
            },
          },
          select: { id: true },
        });
        await tx.emailVerificationToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken("email-verification", rawToken),
            expiresAt,
          },
        });
        await tx.outboxEvent.create({
          data: {
            eventId: randomUUID(),
            aggregateType: "User",
            aggregateId: user.id,
            eventType: identityEventTypes.verificationEmailRequested,
            payload: asJson({ encrypted: encryptedPayload }),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "CREATE",
            entityType: "USER",
            entityId: user.id,
            requestId: context.requestId,
            ipAddress: context.ipAddress,
            userAgent: safeUserAgent(context.userAgent),
            newValues: { role: "CUSTOMER", verificationPending: true },
          },
        });
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return genericAcceptedMessage;
      }
      throw error;
    }

    return genericAcceptedMessage;
  }

  async verifyEmail(rawToken: string, context: RequestSecurityContext): Promise<void> {
    const now = new Date();
    const tokenHash = hashToken("email-verification", rawToken);
    const token = await this.database.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true, revokedAt: true },
    });
    if (
      token === null ||
      token.usedAt !== null ||
      token.revokedAt !== null ||
      token.expiresAt <= now
    ) {
      throw invalidToken();
    }

    await this.database.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationToken.updateMany({
        where: { id: token.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) throw invalidToken();
      await tx.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: now },
      });
      await tx.emailVerificationToken.updateMany({
        where: {
          userId: token.userId,
          id: { not: token.id },
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          userId: token.userId,
          action: "EMAIL_VERIFIED",
          entityType: "USER",
          entityId: token.userId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: safeUserAgent(context.userAgent),
        },
      });
    });
  }

  async resendVerification(emailInput: string): Promise<string> {
    const email = normalizeEmail(emailInput);
    const user = await this.database.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerifiedAt: true, status: true },
    });
    if (user === null || user.emailVerifiedAt !== null || user.status !== "ACTIVE") {
      return genericAcceptedMessage;
    }

    const rawToken = generateOpaqueToken();
    const now = new Date();
    const encryptedPayload = encryptIdentityPayload({
      template: "verify-email",
      to: user.email,
      link: createFragmentLink(env.FRONTEND_VERIFY_EMAIL_URL, rawToken),
    } satisfies IdentityEmailPayload);
    await this.database.$transaction([
      this.database.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.database.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken("email-verification", rawToken),
          expiresAt: addSeconds(now, env.EMAIL_VERIFICATION_TTL_SECONDS),
        },
      }),
      this.database.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "User",
          aggregateId: user.id,
          eventType: identityEventTypes.verificationEmailRequested,
          payload: asJson({ encrypted: encryptedPayload }),
        },
      }),
    ]);
    return genericAcceptedMessage;
  }

  async login(
    input: LoginInput,
    context: RequestSecurityContext,
  ): Promise<SessionIssueResult> {
    const email = normalizeEmail(input.email);
    const throttleHashes = this.throttleHashes(email, context.ipAddress);
    await this.assertNotThrottled(throttleHashes);
    const user = await this.repository.findUserForAuthentication(email);
    const passwordValid = await verifyPassword(user?.passwordHash, input.password);
    const now = new Date();
    const eligible =
      user !== null &&
      user.status === "ACTIVE" &&
      user.emailVerifiedAt !== null &&
      (user.lockedUntil === null || user.lockedUntil <= now);

    if (!passwordValid || !eligible || user === null) {
      await this.recordFailedLogin(user?.id, throttleHashes, context);
      throw invalidAuthentication();
    }

    const passwordUpdate = passwordNeedsRehash(user.passwordHash)
      ? { passwordHash: await hashPassword(input.password) }
      : {};
    await this.database.user.update({
      where: { id: user.id },
      data: {
        ...passwordUpdate,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });
    await this.clearThrottles(throttleHashes);
    const mfaRequired = identityRequiresMfa(user.role, user.mfaFactors.length);
    const result = await this.issueSession(
      { id: user.id, email: user.email, role: user.role },
      mfaRequired,
      context,
    );
    await this.database.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        entityType: "SESSION",
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: safeUserAgent(context.userAgent),
        newValues: { mfaRequired },
      },
    });
    return result;
  }

  async logout(userId: string, sessionId: string, context: RequestSecurityContext) {
    const now = new Date();
    await this.database.$transaction([
      this.database.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.database.auditLog.create({
        data: {
          userId,
          action: "LOGOUT",
          entityType: "SESSION",
          entityId: sessionId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: safeUserAgent(context.userAgent),
        },
      }),
    ]);
  }

  async session(userId: string, sessionId: string) {
    const value = await this.database.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: {
        id: true,
        expiresAt: true,
        idleExpiresAt: true,
        mfaRequired: true,
        mfaVerifiedAt: true,
        user: { select: { id: true, email: true, role: true, emailVerifiedAt: true } },
      },
    });
    if (value === null) throw invalidAuthentication();
    return value;
  }

  async listSessions(userId: string, currentSessionId: string) {
    const now = new Date();
    const sessions = await this.database.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        idleExpiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        mfaVerifiedAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });
    return sessions.map((item) => ({
      id: item.id,
      current: item.id === currentSessionId,
      createdAt: item.createdAt,
      lastUsedAt: item.lastUsedAt,
      expiresAt: item.expiresAt,
      mfaVerified: item.mfaVerifiedAt !== null,
      network: this.maskIp(item.ipAddress),
      client: this.clientLabel(item.userAgent),
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId: string,
    context: RequestSecurityContext,
  ): Promise<void> {
    if (sessionId === currentSessionId) {
      throw identityConflict("Use logout to revoke the current session");
    }
    const now = new Date();
    await this.database.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: now },
      });
      if (revoked.count === 1) {
        await tx.auditLog.create({
          data: {
            userId,
            action: "SESSION_REVOKED",
            entityType: "SESSION",
            entityId: sessionId,
            requestId: context.requestId,
            ipAddress: context.ipAddress,
            userAgent: safeUserAgent(context.userAgent),
          },
        });
      }
    });
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
    context: RequestSecurityContext,
  ): Promise<void> {
    const now = new Date();
    await this.database.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: { userId, id: { not: currentSessionId }, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "SESSION_REVOKED",
          entityType: "SESSION",
          entityId: currentSessionId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: safeUserAgent(context.userAgent),
          newValues: { otherSessionsRevoked: revoked.count },
        },
      });
    });
  }

  async rotateCsrf(userId: string, sessionId: string): Promise<string> {
    const csrf = issueCsrfToken();
    const updated = await this.database.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { csrfTokenHash: csrf.hash },
    });
    if (updated.count !== 1) throw invalidAuthentication();
    return csrf.raw;
  }

  async forgotPassword(emailInput: string): Promise<string> {
    const email = normalizeEmail(emailInput);
    const user = await this.database.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerifiedAt: true, status: true },
    });
    if (user === null || user.emailVerifiedAt === null || user.status !== "ACTIVE") {
      return genericAcceptedMessage;
    }
    const rawToken = generateOpaqueToken();
    const now = new Date();
    const encryptedPayload = encryptIdentityPayload({
      template: "reset-password",
      to: user.email,
      link: createFragmentLink(env.FRONTEND_RESET_PASSWORD_URL, rawToken),
    } satisfies IdentityEmailPayload);
    await this.database.$transaction([
      this.database.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.database.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken("password-reset", rawToken),
          expiresAt: addSeconds(now, env.PASSWORD_RESET_TTL_SECONDS),
        },
      }),
      this.database.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "User",
          aggregateId: user.id,
          eventType: identityEventTypes.passwordResetEmailRequested,
          payload: asJson({ encrypted: encryptedPayload }),
        },
      }),
    ]);
    return genericAcceptedMessage;
  }

  async resetPassword(
    rawToken: string,
    password: string,
    context: RequestSecurityContext,
  ): Promise<void> {
    const tokenHash = hashToken("password-reset", rawToken);
    const token = await this.database.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });
    if (token === null) throw invalidToken();
    const passwordHash = await hashPassword(password);
    const now = new Date();
    await this.database.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) throw invalidToken();
      await tx.user.update({
        where: { id: token.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.passwordResetToken.updateMany({
        where: {
          userId: token.userId,
          id: { not: token.id },
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      await tx.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          userId: token.userId,
          action: "PASSWORD_RESET",
          entityType: "USER",
          entityId: token.userId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: safeUserAgent(context.userAgent),
        },
      });
    });
  }

  async changePassword(
    userId: string,
    sessionId: string,
    input: ChangePasswordInput,
    context: RequestSecurityContext,
  ): Promise<SessionIssueResult> {
    const user = await this.repository.findUserPassword(userId);
    if (
      user === null ||
      !(await verifyPassword(user.passwordHash, input.currentPassword))
    ) {
      throw invalidAuthentication();
    }
    const now = new Date();
    const passwordHash = await hashPassword(input.newPassword);
    await this.database.$transaction([
      this.database.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: now },
      }),
      this.database.session.updateMany({
        where: { userId, id: { not: sessionId }, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.database.passwordResetToken.updateMany({
        where: { userId, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.database.auditLog.create({
        data: {
          userId,
          action: "UPDATE",
          entityType: "USER",
          entityId: userId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: safeUserAgent(context.userAgent),
          newValues: { passwordChanged: true, otherSessionsRevoked: true },
        },
      }),
    ]);
    const currentSession = await this.database.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: { mfaRequired: true, mfaVerifiedAt: true },
    });
    if (currentSession === null) throw invalidAuthentication();
    return this.rotateAuthenticatedSession(
      { id: user.id, email: user.email, role: user.role },
      sessionId,
      currentSession.mfaRequired,
      currentSession.mfaVerifiedAt !== null,
    );
  }

  async setupTotp(userId: string) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user === null) throw invalidAuthentication();
    const enrollment = createTotpEnrollment(user.email);
    const encrypted = encryptTotpSecret(enrollment.secret);
    const factor = await this.database.$transaction(async (tx) => {
      await tx.mfaFactor.deleteMany({
        where: { userId, type: "TOTP", status: "PENDING" },
      });
      return tx.mfaFactor.create({
        data: {
          userId,
          type: "TOTP",
          status: "PENDING",
          name: "Authenticator app",
          encryptedSecret: serializeEncryptedEnvelope(encrypted),
          encryptionKeyId: encrypted.keyId,
        },
        select: { id: true },
      });
    });
    return { factorId: factor.id, secret: enrollment.secret, uri: enrollment.uri };
  }

  async verifyTotpSetup(
    userId: string,
    sessionId: string,
    factorId: string,
    code: string,
  ) {
    const factor = await this.database.mfaFactor.findFirst({
      where: { id: factorId, userId, type: "TOTP", status: "PENDING", revokedAt: null },
      select: { id: true, encryptedSecret: true },
    });
    if (factor?.encryptedSecret === null || factor?.encryptedSecret === undefined) {
      throw invalidToken();
    }
    const secret = decryptTotpSecret(parseEncryptedEnvelope(factor.encryptedSecret));
    const verification = await verifyTotp(secret, code);
    if (!verification.valid || verification.usedAt === undefined) throw invalidToken();
    const recoveryCodes = generateRecoveryCodes();
    const now = new Date();
    const usedAt = verification.usedAt;
    await this.database.$transaction(async (tx) => {
      const activated = await tx.mfaFactor.updateMany({
        where: { id: factor.id, userId, status: "PENDING", revokedAt: null },
        data: { status: "ACTIVE", verifiedAt: now, lastUsedAt: usedAt },
      });
      if (activated.count !== 1) throw invalidToken();
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map(({ hash }) => ({ userId, codeHash: hash })),
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "MFA_ENABLED",
          entityType: "MFA_FACTOR",
          entityId: factor.id,
        },
      });
    });
    const rotated = await this.completeMfaSession(userId, sessionId);
    return { recoveryCodes: recoveryCodes.map(({ raw }) => raw), session: rotated };
  }

  async webAuthnRegistrationOptions(userId: string, sessionId: string) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        mfaFactors: {
          where: { type: "WEBAUTHN", revokedAt: null },
          select: { credentialId: true },
        },
      },
    });
    if (user === null) throw invalidAuthentication();
    const options = await createWebAuthnRegistrationOptions({
      userId,
      email: user.email,
      excludedCredentialIds: user.mfaFactors.flatMap((factor) =>
        factor.credentialId === null ? [] : [factor.credentialId],
      ),
    });
    const now = new Date();
    await this.database.$transaction([
      this.database.mfaChallenge.deleteMany({
        where: { sessionId, purpose: "REGISTRATION", usedAt: null },
      }),
      this.database.mfaChallenge.create({
        data: {
          userId,
          sessionId,
          purpose: "REGISTRATION",
          challengeHash: hashToken("webauthn-challenge", options.challenge),
          expiresAt: addSeconds(now, env.WEBAUTHN_CHALLENGE_TTL_SECONDS),
        },
      }),
    ]);
    return options;
  }

  async verifyWebAuthnSetup(
    userId: string,
    sessionId: string,
    response: unknown,
    name?: string,
  ) {
    const challenge = await this.database.mfaChallenge.findFirst({
      where: {
        userId,
        sessionId,
        purpose: "REGISTRATION",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (challenge === null) throw invalidToken();
    const result = await verifyWebAuthnRegistration({
      response,
      expectedChallengeHash: challenge.challengeHash,
    });
    if (!result.verified) throw invalidToken();
    const { credential } = result.registrationInfo;
    const recoveryCodes = generateRecoveryCodes();
    const now = new Date();
    await this.database.$transaction(async (tx) => {
      const consumed = await tx.mfaChallenge.updateMany({
        where: { id: challenge.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) throw invalidToken();
      const createdFactor = await tx.mfaFactor.create({
        data: {
          userId,
          type: "WEBAUTHN",
          status: "ACTIVE",
          name: name ?? "Security key",
          credentialId: credential.id,
          publicKey: Uint8Array.from(credential.publicKey),
          signCount: BigInt(credential.counter),
          verifiedAt: now,
        },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map(({ hash }) => ({ userId, codeHash: hash })),
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "MFA_ENABLED",
          entityType: "MFA_FACTOR",
          entityId: createdFactor.id,
          newValues: { factorType: "WEBAUTHN" },
        },
      });
    });
    const rotated = await this.completeMfaSession(userId, sessionId);
    return { recoveryCodes: recoveryCodes.map(({ raw }) => raw), session: rotated };
  }

  async mfaChallengeOptions(userId: string, sessionId: string, method: string) {
    if (method !== "webauthn") {
      const count =
        method === "totp"
          ? await this.database.mfaFactor.count({
              where: { userId, type: "TOTP", status: "ACTIVE", revokedAt: null },
            })
          : await this.database.mfaRecoveryCode.count({
              where: { userId, usedAt: null },
            });
      if (count === 0) throw invalidToken();
      return { method, available: true };
    }
    const factors = await this.database.mfaFactor.findMany({
      where: { userId, type: "WEBAUTHN", status: "ACTIVE", revokedAt: null },
      select: { credentialId: true },
    });
    const credentialIds = factors.flatMap((factor) =>
      factor.credentialId === null ? [] : [factor.credentialId],
    );
    if (credentialIds.length === 0) throw invalidToken();
    const options = await createWebAuthnAuthenticationOptions(credentialIds);
    const now = new Date();
    await this.database.$transaction([
      this.database.mfaChallenge.deleteMany({
        where: { sessionId, purpose: "AUTHENTICATION", usedAt: null },
      }),
      this.database.mfaChallenge.create({
        data: {
          userId,
          sessionId,
          purpose: "AUTHENTICATION",
          challengeHash: hashToken("webauthn-challenge", options.challenge),
          expiresAt: addSeconds(now, env.WEBAUTHN_CHALLENGE_TTL_SECONDS),
        },
      }),
    ]);
    return options;
  }

  async verifyMfaChallenge(
    userId: string,
    sessionId: string,
    input: MfaChallengeVerifyInput,
  ): Promise<SessionIssueResult> {
    if (input.method === "totp") {
      const factor = await this.database.mfaFactor.findFirst({
        where: {
          id: input.factorId,
          userId,
          type: "TOTP",
          status: "ACTIVE",
          revokedAt: null,
        },
        select: { id: true, encryptedSecret: true, lastUsedAt: true },
      });
      if (factor?.encryptedSecret === null || factor?.encryptedSecret === undefined) {
        throw invalidToken();
      }
      const result = await verifyTotp(
        decryptTotpSecret(parseEncryptedEnvelope(factor.encryptedSecret)),
        input.code,
        factor.lastUsedAt,
      );
      if (!result.valid || result.usedAt === undefined) throw invalidToken();
      const updated = await this.database.mfaFactor.updateMany({
        where: {
          id: factor.id,
          status: "ACTIVE",
          revokedAt: null,
          lastUsedAt: factor.lastUsedAt,
        },
        data: { lastUsedAt: result.usedAt },
      });
      if (updated.count !== 1) throw invalidToken();
    } else if (input.method === "recovery-code") {
      const used = await this.database.mfaRecoveryCode.updateMany({
        where: {
          userId,
          codeHash: hashToken("recovery-code", input.code),
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) throw invalidToken();
    } else {
      await this.verifyWebAuthnChallenge(userId, sessionId, input.response);
    }
    return this.completeMfaSession(userId, sessionId);
  }

  async listFactors(userId: string) {
    return this.database.mfaFactor.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        name: true,
        verifiedAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async deleteFactor(userId: string, factorId: string, password: string): Promise<void> {
    const user = await this.repository.findUserPassword(userId);
    if (user === null || !(await verifyPassword(user.passwordHash, password))) {
      throw invalidAuthentication();
    }
    const activeCount = await this.database.mfaFactor.count({
      where: { userId, status: "ACTIVE", revokedAt: null },
    });
    if (!mayRemoveFinalMfaFactor(user.role) && activeCount <= 1) {
      throw identityConflict("Privileged accounts must retain an active MFA factor");
    }
    const now = new Date();
    const result = await this.database.mfaFactor.updateMany({
      where: { id: factorId, userId, status: "ACTIVE", revokedAt: null },
      data: { status: "REVOKED", revokedAt: now },
    });
    if (result.count !== 1) throw invalidToken();
    await this.database.auditLog.create({
      data: {
        userId,
        action: "MFA_DISABLED",
        entityType: "MFA_FACTOR",
        entityId: factorId,
      },
    });
  }

  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const recoveryCodes = generateRecoveryCodes();
    await this.database.$transaction(async (tx) => {
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map(({ hash }) => ({ userId, codeHash: hash })),
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "UPDATE",
          entityType: "MFA_FACTOR",
          newValues: { recoveryCodesRegenerated: true },
        },
      });
    });
    return recoveryCodes.map(({ raw }) => raw);
  }

  private async issueSession(
    user: { id: string; email: string; role: UserRole },
    mfaRequired: boolean,
    context: RequestSecurityContext,
  ): Promise<SessionIssueResult> {
    const now = new Date();
    const rawToken = generateOpaqueToken();
    const csrf = issueCsrfToken();
    const pending = mfaRequired;
    const absoluteSeconds = pending
      ? env.MFA_PENDING_SESSION_TTL_SECONDS
      : user.role === "CUSTOMER"
        ? env.CUSTOMER_SESSION_TTL_SECONDS
        : env.PRIVILEGED_SESSION_TTL_SECONDS;
    const idleSeconds = pending
      ? env.MFA_PENDING_SESSION_TTL_SECONDS
      : user.role === "CUSTOMER"
        ? env.CUSTOMER_SESSION_IDLE_SECONDS
        : env.PRIVILEGED_SESSION_IDLE_SECONDS;
    const expiresAt = addSeconds(now, absoluteSeconds);
    const idleExpiresAt = addSeconds(now, Math.min(absoluteSeconds, idleSeconds));

    await this.database.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${user.id}, 0))`;
      const active = await tx.session.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: now },
          idleExpiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      const revokeIds = active
        .slice(Math.max(0, env.MAX_ACTIVE_SESSIONS - 1))
        .map(({ id }) => id);
      if (revokeIds.length > 0) {
        await tx.session.updateMany({
          where: { id: { in: revokeIds } },
          data: { revokedAt: now },
        });
      }
      await tx.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken("session", rawToken),
          csrfTokenHash: csrf.hash,
          expiresAt,
          idleExpiresAt,
          lastRotatedAt: now,
          mfaRequired,
          mfaVerifiedAt: null,
          ipAddress: context.ipAddress,
          userAgent: safeUserAgent(context.userAgent),
          createdAt: now,
        },
      });
    });
    return { rawToken, csrfToken: csrf.raw, expiresAt, mfaRequired, user };
  }

  private async rotateAuthenticatedSession(
    user: { id: string; email: string; role: UserRole },
    sessionId: string,
    mfaRequired: boolean,
    mfaVerified: boolean,
  ): Promise<SessionIssueResult> {
    const now = new Date();
    const rawToken = generateOpaqueToken();
    const csrf = issueCsrfToken();
    const absoluteSeconds =
      user.role === "CUSTOMER"
        ? env.CUSTOMER_SESSION_TTL_SECONDS
        : env.PRIVILEGED_SESSION_TTL_SECONDS;
    const idleSeconds =
      user.role === "CUSTOMER"
        ? env.CUSTOMER_SESSION_IDLE_SECONDS
        : env.PRIVILEGED_SESSION_IDLE_SECONDS;
    const expiresAt = addSeconds(now, absoluteSeconds);
    const result = await this.database.session.updateMany({
      where: { id: sessionId, userId: user.id, revokedAt: null },
      data: {
        tokenHash: hashToken("session", rawToken),
        csrfTokenHash: csrf.hash,
        expiresAt,
        idleExpiresAt: addSeconds(now, Math.min(absoluteSeconds, idleSeconds)),
        lastRotatedAt: now,
        mfaRequired,
        mfaVerifiedAt: mfaVerified ? now : null,
      },
    });
    if (result.count !== 1) throw invalidAuthentication();
    return {
      rawToken,
      csrfToken: csrf.raw,
      expiresAt,
      mfaRequired,
      user,
    };
  }

  private async completeMfaSession(userId: string, sessionId: string) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (user === null) throw invalidAuthentication();
    return this.rotateAuthenticatedSession(user, sessionId, true, true);
  }

  private throttleHashes(email: string, ipAddress: string | null): string[] {
    const ip = ipAddress ?? "unknown";
    return [
      hashToken("throttle-email-ip", `${email}\0${ip}`),
      hashToken("throttle-ip", ip),
    ];
  }

  private async assertNotThrottled(keyHashes: string[]): Promise<void> {
    const blocked = await this.database.authenticationThrottle.findFirst({
      where: { keyHash: { in: keyHashes }, blockedUntil: { gt: new Date() } },
      select: { id: true },
    });
    if (blocked !== null) throw invalidAuthentication();
  }

  private async recordFailedLogin(
    userId: string | undefined,
    throttleHashes: string[],
    context: RequestSecurityContext,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = addSeconds(now, env.AUTH_LOCK_SECONDS * 2);
    for (const keyHash of throttleHashes) {
      const current = await this.database.authenticationThrottle.upsert({
        where: { keyHash },
        create: { keyHash, failedCount: 1, lastFailedAt: now, expiresAt },
        update: { failedCount: { increment: 1 }, lastFailedAt: now, expiresAt },
        select: { id: true, failedCount: true },
      });
      if (current.failedCount >= env.AUTH_FAILURE_LIMIT) {
        await this.database.authenticationThrottle.update({
          where: { id: current.id },
          data: { blockedUntil: addSeconds(now, env.AUTH_LOCK_SECONDS) },
        });
      }
    }
    if (userId !== undefined) {
      const user = await this.database.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      if (user.failedLoginAttempts >= env.AUTH_FAILURE_LIMIT) {
        await this.database.user.update({
          where: { id: userId },
          data: { lockedUntil: addSeconds(now, env.AUTH_LOCK_SECONDS) },
        });
      }
      await this.database.auditLog.create({
        data: {
          userId,
          action: "LOGIN_FAILED",
          entityType: "USER",
          entityId: userId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: safeUserAgent(context.userAgent),
        },
      });
    }
  }

  private async clearThrottles(keyHashes: string[]): Promise<void> {
    await this.database.authenticationThrottle.updateMany({
      where: { keyHash: { in: keyHashes } },
      data: { failedCount: 0, blockedUntil: null },
    });
  }

  private async verifyWebAuthnChallenge(
    userId: string,
    sessionId: string,
    response: unknown,
  ): Promise<void> {
    const credentialId =
      typeof response === "object" && response !== null && "id" in response
        ? response.id
        : undefined;
    if (typeof credentialId !== "string") throw invalidToken();
    const [challenge, factor] = await Promise.all([
      this.database.mfaChallenge.findFirst({
        where: {
          userId,
          sessionId,
          purpose: "AUTHENTICATION",
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.database.mfaFactor.findFirst({
        where: {
          userId,
          type: "WEBAUTHN",
          status: "ACTIVE",
          revokedAt: null,
          credentialId,
        },
      }),
    ]);
    if (
      challenge === null ||
      factor === null ||
      factor.publicKey === null ||
      factor.credentialId === null
    ) {
      throw invalidToken();
    }
    const oldCounter = Number(factor.signCount ?? 0n);
    const result = await verifyWebAuthnAuthentication({
      response,
      expectedChallengeHash: challenge.challengeHash,
      credential: {
        id: factor.credentialId,
        publicKey: factor.publicKey,
        counter: oldCounter,
      },
    });
    if (!result.verified || result.authenticationInfo.newCounter < oldCounter) {
      throw invalidToken();
    }
    const now = new Date();
    await this.database.$transaction(async (tx) => {
      const consumed = await tx.mfaChallenge.updateMany({
        where: { id: challenge.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) throw invalidToken();
      const updated = await tx.mfaFactor.updateMany({
        where: { id: factor.id, signCount: factor.signCount, status: "ACTIVE" },
        data: {
          signCount: BigInt(result.authenticationInfo.newCounter),
          lastUsedAt: now,
        },
      });
      if (updated.count !== 1) throw invalidToken();
    });
  }

  private maskIp(ipAddress: string | null): string | null {
    if (ipAddress === null) return null;
    if (ipAddress.includes(":"))
      return `${ipAddress.split(":").slice(0, 3).join(":")}::/48`;
    const parts = ipAddress.split(".");
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : null;
  }

  private clientLabel(userAgent: string | null): string | null {
    if (userAgent === null) return null;
    const label = userAgent.match(/^[A-Za-z0-9._/-]{1,80}/)?.[0];
    return label ?? "Unknown client";
  }
}

export const identityService = new IdentityService();
