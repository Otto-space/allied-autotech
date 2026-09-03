import type { Request, Response } from "express";

import { successResponse } from "../../common/http/api-response.js";
import { clearSessionCookie, setSessionCookie } from "../../common/security/cookies.js";
import { invalidAuthentication } from "./identity.errors.js";
import type {
  ChangePasswordInput,
  LoginInput,
  MfaChallengeVerifyInput,
  RegisterInput,
} from "./identity.schemas.js";
import { identityService, type IdentityService } from "./identity.service.js";
import type { RequestSecurityContext, SessionIssueResult } from "./identity.types.js";

function body<T>(response: Response): T {
  return response.locals.validated?.["body"] as T;
}

function params<T>(response: Response): T {
  return response.locals.validated?.["params"] as T;
}

function context(request: Request): RequestSecurityContext {
  return {
    requestId: String(request.id),
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}

function actor(request: Request) {
  if (request.actor === undefined) throw invalidAuthentication();
  return request.actor;
}

function issueCookie(response: Response, result: SessionIssueResult): void {
  setSessionCookie(response, result.rawToken, result.expiresAt);
}

export class IdentityController {
  constructor(private readonly service: IdentityService = identityService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const message = await this.service.register(body<RegisterInput>(res), context(req));
    res.status(202).json(successResponse(message, req.id));
  };

  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    await this.service.verifyEmail(body<{ token: string }>(res).token, context(req));
    res.status(200).json(successResponse("Email verified", req.id));
  };

  resendEmail = async (req: Request, res: Response): Promise<void> => {
    const message = await this.service.resendVerification(
      body<{ email: string }>(res).email,
    );
    res.status(202).json(successResponse(message, req.id));
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.login(body<LoginInput>(res), context(req));
    issueCookie(res, result);
    res.status(200).json(
      successResponse("Authenticated", req.id, {
        user: result.user,
        mfaRequired: result.mfaRequired,
      }),
    );
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    await this.service.logout(current.userId, current.sessionId, context(req));
    clearSessionCookie(res);
    res.status(200).json(successResponse("Signed out", req.id));
  };

  currentSession = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    const session = await this.service.session(current.userId, current.sessionId);
    res.status(200).json(successResponse("Session retrieved", req.id, session));
  };

  sessions = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    const sessions = await this.service.listSessions(current.userId, current.sessionId);
    res.status(200).json(successResponse("Sessions retrieved", req.id, { sessions }));
  };

  revokeSession = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    await this.service.revokeSession(
      current.userId,
      params<{ sessionId: string }>(res).sessionId,
      current.sessionId,
      context(req),
    );
    res.status(200).json(successResponse("Session revoked", req.id));
  };

  revokeOtherSessions = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    await this.service.revokeOtherSessions(
      current.userId,
      current.sessionId,
      context(req),
    );
    res.status(200).json(successResponse("Other sessions revoked", req.id));
  };

  csrf = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    const csrfToken = await this.service.rotateCsrf(current.userId, current.sessionId);
    res.status(200).json(successResponse("CSRF token rotated", req.id, { csrfToken }));
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const message = await this.service.forgotPassword(body<{ email: string }>(res).email);
    res.status(202).json(successResponse(message, req.id));
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const input = body<{ token: string; password: string }>(res);
    await this.service.resetPassword(input.token, input.password, context(req));
    clearSessionCookie(res);
    res.status(200).json(successResponse("Password reset", req.id));
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    const result = await this.service.changePassword(
      current.userId,
      current.sessionId,
      body<ChangePasswordInput>(res),
      context(req),
    );
    issueCookie(res, result);
    res
      .status(200)
      .json(successResponse("Password changed", req.id, { csrfToken: result.csrfToken }));
  };

  setupTotp = async (req: Request, res: Response): Promise<void> => {
    const enrollment = await this.service.setupTotp(actor(req).userId);
    res.status(201).json(successResponse("TOTP enrollment created", req.id, enrollment));
  };

  verifyTotpSetup = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    const input = body<{ factorId: string; code: string }>(res);
    const result = await this.service.verifyTotpSetup(
      current.userId,
      current.sessionId,
      input.factorId,
      input.code,
    );
    issueCookie(res, result.session);
    res.status(200).json(
      successResponse("TOTP enabled", req.id, {
        recoveryCodes: result.recoveryCodes,
        csrfToken: result.session.csrfToken,
      }),
    );
  };

  webAuthnOptions = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    const options = await this.service.webAuthnRegistrationOptions(
      current.userId,
      current.sessionId,
    );
    res.status(200).json(successResponse("WebAuthn options created", req.id, options));
  };

  verifyWebAuthn = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    const input = body<{ name?: string; response: unknown }>(res);
    const result = await this.service.verifyWebAuthnSetup(
      current.userId,
      current.sessionId,
      input.response,
      input.name,
    );
    issueCookie(res, result.session);
    res.status(200).json(
      successResponse("WebAuthn factor enabled", req.id, {
        recoveryCodes: result.recoveryCodes,
        csrfToken: result.session.csrfToken,
      }),
    );
  };

  challengeOptions = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    const options = await this.service.mfaChallengeOptions(
      current.userId,
      current.sessionId,
      body<{ method: string }>(res).method,
    );
    res.status(200).json(successResponse("MFA options created", req.id, options));
  };

  verifyChallenge = async (req: Request, res: Response): Promise<void> => {
    const current = actor(req);
    const result = await this.service.verifyMfaChallenge(
      current.userId,
      current.sessionId,
      body<MfaChallengeVerifyInput>(res),
    );
    issueCookie(res, result);
    res
      .status(200)
      .json(successResponse("MFA verified", req.id, { csrfToken: result.csrfToken }));
  };

  factors = async (req: Request, res: Response): Promise<void> => {
    const factors = await this.service.listFactors(actor(req).userId);
    res.status(200).json(successResponse("MFA factors retrieved", req.id, { factors }));
  };

  deleteFactor = async (req: Request, res: Response): Promise<void> => {
    await this.service.deleteFactor(
      actor(req).userId,
      params<{ factorId: string }>(res).factorId,
      body<{ password: string }>(res).password,
    );
    res.status(200).json(successResponse("MFA factor revoked", req.id));
  };

  regenerateRecoveryCodes = async (req: Request, res: Response): Promise<void> => {
    const recoveryCodes = await this.service.regenerateRecoveryCodes(actor(req).userId);
    res
      .status(200)
      .json(successResponse("Recovery codes regenerated", req.id, { recoveryCodes }));
  };
}
