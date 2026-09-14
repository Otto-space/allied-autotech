import { randomUUID } from "node:crypto";

import { generate } from "otplib";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { decryptIdentityPayload } from "../../src/common/security/mfa-encryption.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { prisma } from "../../src/config/database.js";
import type { IdentityEmailPayload } from "../../src/modules/identity/identity.types.js";
import type { TransactionalEmail } from "../../src/providers/messaging/email-provider.port.js";
import { IdentityOutboxWorker } from "../../src/workers/outbox.worker.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const origin = "http://localhost:3000";

describe.skipIf(!runDatabaseTests)("database-backed identity flow", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers, verifies, logs in, rotates CSRF, and logs out without storing raw tokens", async () => {
    await prisma.authenticationThrottle.deleteMany();
    const app = createApp({ checkReadiness: async () => undefined });
    const email = `identity-${randomUUID()}@example.test`;
    const password = "a uniquely strong integration passphrase";
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send({
        email,
        password,
        firstName: "Integration",
        lastName: "Test",
        phone: "+234 800 000 0000",
      });
    expect(registration.status).toBe(202);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { profile: true, emailVerificationTokens: true },
    });
    expect(user.profile).toMatchObject({ firstName: "Integration", lastName: "Test" });
    expect(user.passwordHash).toContain("$argon2id$");

    const outbox = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: user.id },
    });
    expect(JSON.stringify(outbox.payload)).not.toContain("#token=");
    const encrypted = (
      outbox.payload as { encrypted: Parameters<typeof decryptIdentityPayload>[0] }
    ).encrypted;
    const payload = decryptIdentityPayload<IdentityEmailPayload>(encrypted);
    const originalToken = decodeURIComponent(
      new URL(payload.link).hash.slice("#token=".length),
    );
    expect(user.emailVerificationTokens[0]?.tokenHash).toBe(
      hashToken("email-verification", originalToken),
    );

    const duplicate = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send({
        email,
        password,
        firstName: "Integration",
        lastName: "Test",
        phone: "+234 800 000 0000",
      });
    const resend = await request(app)
      .post("/api/v1/auth/email/resend")
      .set("Origin", origin)
      .send({ email });
    const unknownResend = await request(app)
      .post("/api/v1/auth/email/resend")
      .set("Origin", origin)
      .send({ email: `unknown-${randomUUID()}@example.test` });
    expect(duplicate.status).toBe(202);
    expect(resend.body.message).toBe(unknownResend.body.message);
    const latestOutbox = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: user.id },
      orderBy: { createdAt: "desc" },
    });
    const latestPayload = decryptIdentityPayload<IdentityEmailPayload>(
      (
        latestOutbox.payload as {
          encrypted: Parameters<typeof decryptIdentityPayload>[0];
        }
      ).encrypted,
    );
    const token = decodeURIComponent(
      new URL(latestPayload.link).hash.slice("#token=".length),
    );
    const revokedVerification = await request(app)
      .post("/api/v1/auth/email/verify")
      .set("Origin", origin)
      .send({ token: originalToken });
    expect(revokedVerification.status).toBe(400);

    const delivered: TransactionalEmail[] = [];
    const worker = new IdentityOutboxWorker({
      send(message) {
        delivered.push(message);
        return Promise.resolve();
      },
    });
    await worker.runOnce(100);
    expect(
      delivered.some(({ idempotencyKey }) => idempotencyKey === outbox.eventId),
    ).toBe(true);
    expect(
      (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outbox.id } })).status,
    ).toBe("PUBLISHED");
    await worker.runOnce(100);
    expect(
      delivered.filter(({ idempotencyKey }) => idempotencyKey === outbox.eventId),
    ).toHaveLength(1);
    const poison = await prisma.outboxEvent.create({
      data: {
        eventId: randomUUID(),
        aggregateType: "User",
        aggregateId: user.id,
        eventType: "identity.verification-email.requested.v1",
        payload: { malformed: true },
      },
    });
    await worker.runOnce(100);
    expect(
      (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: poison.id } })).status,
    ).toBe("FAILED");
    await prisma.outboxEvent.update({
      where: { id: poison.id },
      data: { attempts: 7, availableAt: new Date() },
    });
    await worker.runOnce(100);
    expect(
      (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: poison.id } })).status,
    ).toBe("DEAD_LETTER");
    const cleanupKey = hashToken("throttle-ip", randomUUID());
    await prisma.authenticationThrottle.create({
      data: {
        keyHash: cleanupKey,
        createdAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    expect(await worker.cleanupExpiredIdentityState()).toBeGreaterThan(0);
    expect(
      await prisma.authenticationThrottle.findUnique({ where: { keyHash: cleanupKey } }),
    ).toBeNull();

    const verification = await request(app)
      .post("/api/v1/auth/email/verify")
      .set("Origin", origin)
      .send({ token });
    expect(verification.status).toBe(200);
    const verificationReplay = await request(app)
      .post("/api/v1/auth/email/verify")
      .set("Origin", origin)
      .send({ token });
    expect(verificationReplay.status).toBe(400);

    const wrongLogin = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email, password: "an intentionally incorrect password" });
    expect(wrongLogin.status).toBe(401);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.data.mfaRequired).toBe(false);
    const cookie = login.headers["set-cookie"]?.[0];
    expect(cookie).toContain("aat_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(
      (
        await request(app)
          .get("/api/v1/auth/session")
          .set("Cookie", cookie ?? "")
      ).status,
    ).toBe(200);

    const rawSessionToken = cookie?.split(";", 1)[0]?.split("=", 2)[1];
    const storedSession = await prisma.session.findFirstOrThrow({
      where: { userId: user.id, revokedAt: null },
    });
    expect(storedSession.tokenHash).toBe(hashToken("session", rawSessionToken ?? ""));
    expect(storedSession.tokenHash).not.toBe(rawSessionToken);

    const csrf = await request(app)
      .post("/api/v1/auth/csrf")
      .set("Origin", origin)
      .set("Cookie", cookie ?? "");
    expect(csrf.status).toBe(200);
    const csrfToken = csrf.body.data.csrfToken as string;
    expect(csrfToken).not.toBe(
      (await prisma.session.findUniqueOrThrow({ where: { id: storedSession.id } }))
        .csrfTokenHash,
    );
    const missingCsrf = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin)
      .set("Cookie", cookie ?? "");
    expect(missingCsrf.status).toBe(403);

    const secondLogin = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email, password });
    expect(secondLogin.status).toBe(200);
    const secondCookie = secondLogin.headers["set-cookie"]?.[0];
    const sessions = await request(app)
      .get("/api/v1/auth/sessions")
      .set("Cookie", cookie ?? "");
    const otherSession = sessions.body.data.sessions.find(
      (candidate: { current: boolean }) => !candidate.current,
    );
    expect(otherSession).toBeDefined();
    const revokedOther = await request(app)
      .delete(`/api/v1/auth/sessions/${String(otherSession.id)}`)
      .set("Origin", origin)
      .set("Cookie", cookie ?? "")
      .set("X-CSRF-Token", csrfToken);
    expect(revokedOther.status).toBe(200);
    expect(
      (
        await request(app)
          .get("/api/v1/auth/session")
          .set("Cookie", secondCookie ?? "")
      ).status,
    ).toBe(401);

    const setup = await request(app)
      .post("/api/v1/auth/mfa/totp/setup")
      .set("Origin", origin)
      .set("Cookie", cookie ?? "")
      .set("X-CSRF-Token", csrfToken);
    expect(setup.status).toBe(201);
    const totpCode = await generate({ secret: setup.body.data.secret as string });
    const enabled = await request(app)
      .post("/api/v1/auth/mfa/totp/verify")
      .set("Origin", origin)
      .set("Cookie", cookie ?? "")
      .set("X-CSRF-Token", csrfToken)
      .send({ factorId: setup.body.data.factorId, code: totpCode });
    expect(enabled.status).toBe(200);
    expect(enabled.body.data.recoveryCodes).toHaveLength(10);
    const mfaCookie = enabled.headers["set-cookie"]?.[0];
    const mfaCsrf = enabled.body.data.csrfToken as string;

    const fixedSession = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", cookie ?? "");
    expect(fixedSession.status).toBe(401);
    const factors = await request(app)
      .get("/api/v1/auth/mfa/factors")
      .set("Cookie", mfaCookie ?? "");
    expect(factors.status).toBe(200);
    expect(factors.body.data.factors[0]).not.toHaveProperty("encryptedSecret");
    const webAuthnOptions = await request(app)
      .post("/api/v1/auth/mfa/webauthn/options")
      .set("Origin", origin)
      .set("Cookie", mfaCookie ?? "")
      .set("X-CSRF-Token", mfaCsrf)
      .send({ name: "Test security key" });
    expect(webAuthnOptions.status).toBe(200);
    expect(webAuthnOptions.body.data.challenge).toEqual(expect.any(String));

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin)
      .set("Cookie", mfaCookie ?? "")
      .set("X-CSRF-Token", mfaCsrf);
    expect(logout.status).toBe(200);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: storedSession.id } }))
        .revokedAt,
    ).toBeInstanceOf(Date);

    const pendingLogin = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email, password });
    expect(pendingLogin.status).toBe(200);
    expect(pendingLogin.body.data.mfaRequired).toBe(true);
    const pendingCookie = pendingLogin.headers["set-cookie"]?.[0];
    const deniedBeforeMfa = await request(app)
      .get("/api/v1/auth/sessions")
      .set("Cookie", pendingCookie ?? "");
    expect(deniedBeforeMfa.status).toBe(403);

    const pendingCsrfResponse = await request(app)
      .post("/api/v1/auth/csrf")
      .set("Origin", origin)
      .set("Cookie", pendingCookie ?? "");
    const pendingCsrf = pendingCsrfResponse.body.data.csrfToken as string;
    const totpOptions = await request(app)
      .post("/api/v1/auth/mfa/challenge/options")
      .set("Origin", origin)
      .set("Cookie", pendingCookie ?? "")
      .set("X-CSRF-Token", pendingCsrf)
      .send({ method: "totp" });
    expect(totpOptions.status).toBe(200);
    expect(totpOptions.body.data).toEqual({
      method: "totp",
      available: true,
      factors: [{ id: setup.body.data.factorId, name: "Authenticator app" }],
    });
    expect(JSON.stringify(totpOptions.body)).not.toContain("secret");
    const recoveryCode = enabled.body.data.recoveryCodes[0] as string;
    const recoveryOptions = await request(app)
      .post("/api/v1/auth/mfa/challenge/options")
      .set("Origin", origin)
      .set("Cookie", pendingCookie ?? "")
      .set("X-CSRF-Token", pendingCsrf)
      .send({ method: "recovery-code" });
    expect(recoveryOptions.status).toBe(200);
    const assured = await request(app)
      .post("/api/v1/auth/mfa/challenge/verify")
      .set("Origin", origin)
      .set("Cookie", pendingCookie ?? "")
      .set("X-CSRF-Token", pendingCsrf)
      .send({ method: "recovery-code", code: recoveryCode });
    expect(assured.status).toBe(200);
    const assuredCookie = assured.headers["set-cookie"]?.[0];
    const assuredCsrf = assured.body.data.csrfToken as string;
    const replay = await request(app)
      .post("/api/v1/auth/mfa/challenge/verify")
      .set("Origin", origin)
      .set("Cookie", assuredCookie ?? "")
      .set("X-CSRF-Token", assuredCsrf)
      .send({ method: "recovery-code", code: recoveryCode });
    expect(replay.status).toBe(400);

    const regenerated = await request(app)
      .post("/api/v1/auth/mfa/recovery-codes/regenerate")
      .set("Origin", origin)
      .set("Cookie", assuredCookie ?? "")
      .set("X-CSRF-Token", assuredCsrf);
    expect(regenerated.status).toBe(200);
    expect(regenerated.body.data.recoveryCodes).toHaveLength(10);

    const intermediatePassword = "a changed and still strong integration passphrase";
    const changed = await request(app)
      .post("/api/v1/auth/password/change")
      .set("Origin", origin)
      .set("Cookie", assuredCookie ?? "")
      .set("X-CSRF-Token", assuredCsrf)
      .send({ currentPassword: password, newPassword: intermediatePassword });
    expect(changed.status).toBe(200);
    const changedCookie = changed.headers["set-cookie"]?.[0];
    expect(changedCookie).not.toBe(assuredCookie);

    const forgot = await request(app)
      .post("/api/v1/auth/password/forgot")
      .set("Origin", origin)
      .send({ email });
    expect(forgot.status).toBe(202);
    const unknownForgot = await request(app)
      .post("/api/v1/auth/password/forgot")
      .set("Origin", origin)
      .send({ email: `unknown-${randomUUID()}@example.test` });
    expect(unknownForgot.body.message).toBe(forgot.body.message);
    const resetOutbox = await prisma.outboxEvent.findFirstOrThrow({
      where: {
        aggregateId: user.id,
        eventType: "identity.password-reset-email.requested.v1",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(JSON.stringify(resetOutbox.payload)).not.toContain("#token=");
    const resetPayload = decryptIdentityPayload<IdentityEmailPayload>(
      (
        resetOutbox.payload as {
          encrypted: Parameters<typeof decryptIdentityPayload>[0];
        }
      ).encrypted,
    );
    const resetToken = decodeURIComponent(
      new URL(resetPayload.link).hash.slice("#token=".length),
    );
    const finalPassword = "the final strong integration test passphrase";
    const reset = await request(app)
      .post("/api/v1/auth/password/reset")
      .set("Origin", origin)
      .send({ token: resetToken, password: finalPassword });
    expect(reset.status).toBe(200);
    const resetReplay = await request(app)
      .post("/api/v1/auth/password/reset")
      .set("Origin", origin)
      .send({ token: resetToken, password: finalPassword });
    expect(resetReplay.status).toBe(400);

    const revokedAfterReset = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", changedCookie ?? "");
    expect(revokedAfterReset.status).toBe(401);
    const finalLogin = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email, password: finalPassword });
    expect(finalLogin.status).toBe(200);
    expect(finalLogin.body.data.mfaRequired).toBe(true);
    const finalCookie = finalLogin.headers["set-cookie"]?.[0];
    await prisma.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    const suspendedSession = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", finalCookie ?? "");
    expect(suspendedSession.status).toBe(401);
    await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", origin)
        .send({ email, password: "an intentionally incorrect password" });
      expect(failed.status).toBe(401);
    }
    const lockedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(lockedUser.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    const lockedLogin = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email, password: finalPassword });
    expect(lockedLogin.status).toBe(401);
  }, 60_000);
});
