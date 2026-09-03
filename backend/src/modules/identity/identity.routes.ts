import { Router } from "express";

import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCsrf, requireTrustedOrigin } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { IdentityController } from "./identity.controller.js";
import {
  changePasswordBodySchema,
  emailBodySchema,
  emptyObjectSchema,
  factorDeleteBodySchema,
  factorParamsSchema,
  loginBodySchema,
  mfaChallengeOptionsBodySchema,
  mfaChallengeVerifyBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  sessionParamsSchema,
  tokenBodySchema,
  totpVerifyBodySchema,
  webauthnOptionsBodySchema,
  webauthnVerifyBodySchema,
} from "./identity.schemas.js";

export function createIdentityRouter(): Router {
  const router = Router();
  const controller = new IdentityController();
  const pendingAuth = authenticate({ allowMfaPending: true });
  const fullAuth = authenticate();

  router.post(
    "/register",
    createSensitiveRateLimit(5, 60 * 60 * 1_000),
    requireTrustedOrigin,
    validate({ body: registerBodySchema }),
    controller.register,
  );
  router.post(
    "/email/verify",
    createSensitiveRateLimit(10),
    requireTrustedOrigin,
    validate({ body: tokenBodySchema }),
    controller.verifyEmail,
  );
  router.post(
    "/email/resend",
    createSensitiveRateLimit(3, 60 * 60 * 1_000),
    requireTrustedOrigin,
    validate({ body: emailBodySchema }),
    controller.resendEmail,
  );
  router.post(
    "/login",
    createSensitiveRateLimit(20),
    requireTrustedOrigin,
    validate({ body: loginBodySchema }),
    controller.login,
  );
  router.post(
    "/password/forgot",
    createSensitiveRateLimit(5, 60 * 60 * 1_000),
    requireTrustedOrigin,
    validate({ body: emailBodySchema }),
    controller.forgotPassword,
  );
  router.post(
    "/password/reset",
    createSensitiveRateLimit(10),
    requireTrustedOrigin,
    validate({ body: resetPasswordBodySchema }),
    controller.resetPassword,
  );

  router.post(
    "/csrf",
    createSensitiveRateLimit(30),
    pendingAuth,
    requireTrustedOrigin,
    validate({ body: emptyObjectSchema }),
    controller.csrf,
  );
  router.post(
    "/logout",
    pendingAuth,
    requireCsrf,
    validate({ body: emptyObjectSchema }),
    controller.logout,
  );
  router.get(
    "/session",
    pendingAuth,
    validate({ query: emptyObjectSchema }),
    controller.currentSession,
  );
  router.get(
    "/sessions",
    fullAuth,
    validate({ query: emptyObjectSchema }),
    controller.sessions,
  );
  router.delete(
    "/sessions",
    fullAuth,
    requireCsrf,
    validate({ body: emptyObjectSchema, query: emptyObjectSchema }),
    controller.revokeOtherSessions,
  );
  router.delete(
    "/sessions/:sessionId",
    fullAuth,
    requireCsrf,
    validate({
      params: sessionParamsSchema,
      query: emptyObjectSchema,
      body: emptyObjectSchema,
    }),
    controller.revokeSession,
  );
  router.post(
    "/password/change",
    fullAuth,
    requireCsrf,
    validate({ body: changePasswordBodySchema }),
    controller.changePassword,
  );

  router.post(
    "/mfa/totp/setup",
    pendingAuth,
    requireCsrf,
    validate({ body: emptyObjectSchema }),
    controller.setupTotp,
  );
  router.post(
    "/mfa/totp/verify",
    createSensitiveRateLimit(10),
    pendingAuth,
    requireCsrf,
    validate({ body: totpVerifyBodySchema }),
    controller.verifyTotpSetup,
  );
  router.post(
    "/mfa/webauthn/options",
    pendingAuth,
    requireCsrf,
    validate({ body: webauthnOptionsBodySchema }),
    controller.webAuthnOptions,
  );
  router.post(
    "/mfa/webauthn/verify",
    createSensitiveRateLimit(10),
    pendingAuth,
    requireCsrf,
    validate({ body: webauthnVerifyBodySchema }),
    controller.verifyWebAuthn,
  );
  router.post(
    "/mfa/challenge/options",
    createSensitiveRateLimit(20),
    pendingAuth,
    requireCsrf,
    validate({ body: mfaChallengeOptionsBodySchema }),
    controller.challengeOptions,
  );
  router.post(
    "/mfa/challenge/verify",
    createSensitiveRateLimit(10),
    pendingAuth,
    requireCsrf,
    validate({ body: mfaChallengeVerifyBodySchema }),
    controller.verifyChallenge,
  );
  router.get(
    "/mfa/factors",
    fullAuth,
    validate({ query: emptyObjectSchema }),
    controller.factors,
  );
  router.delete(
    "/mfa/factors/:factorId",
    fullAuth,
    requireCsrf,
    validate({ params: factorParamsSchema, body: factorDeleteBodySchema }),
    controller.deleteFactor,
  );
  router.post(
    "/mfa/recovery-codes/regenerate",
    fullAuth,
    requireCsrf,
    validate({ body: emptyObjectSchema }),
    controller.regenerateRecoveryCodes,
  );

  return router;
}
