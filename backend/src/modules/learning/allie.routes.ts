import { Router, type Request, type Response, type NextFunction } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCsrf, requireTrustedOrigin } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import { AppError } from "../../common/errors/app-error.js";
import { env } from "../../config/env.js";
import { AllieFailure } from "./allie.contracts.js";
import {
  allieEmptySchema,
  allieCreateSchema,
  allieConversationParams,
  allieTurnSchema,
} from "./allie.schemas.js";
import {
  bootstrapAllieGuest,
  cancelAllieTurn,
  clearAllieConversation,
  createAllieConversation,
  listAllieConversations,
  readAllieConversation,
  requireAllieEnabled,
  submitAllieTurn,
  type AllieOwnerProof,
} from "./allie.conversations.js";

export const allieGuestCookieName =
  env.NODE_ENV === "production" ? "__Host-aat_help" : "aat_help";
function mapFailure(error: unknown) {
  if (!(error instanceof AllieFailure)) return error;
  const messages = {
    invalid_input: "Use a short help question and a supported page context.",
    sensitive_input:
      "Remove passwords, codes, tokens and bank/card details before asking Allie.",
    access_changed:
      "Allie could not verify the current conversation context. Refresh before continuing.",
    not_configured:
      "Conversational Allie is unavailable. Reviewed help and Customer Care remain available.",
    provider_unavailable:
      "Allie could not complete that answer. Your question has not been sent to Customer Care.",
    provider_quota:
      "Allie is temporarily unavailable. Reviewed help and Customer Care remain available.",
    invalid_output:
      "Allie could not verify that answer. Use reviewed help or Customer Care.",
    cancelled:
      "Answer generation was stopped. Review the conversation before starting another turn.",
  } as const;
  const invalid = error.code === "invalid_input" || error.code === "sensitive_input";
  const changed = error.code === "access_changed" || error.code === "cancelled";
  return new AppError({
    code: invalid ? "VALIDATION_FAILED" : changed ? "CONFLICT" : "PROVIDER_UNAVAILABLE",
    statusCode: invalid ? 422 : changed ? 409 : 503,
    message: messages[error.code],
    details: { assistant: [error.code] },
  });
}
const cookie = (req: Request) =>
  typeof req.cookies?.[allieGuestCookieName] === "string"
    ? (req.cookies[allieGuestCookieName] as string)
    : "";
function proof(req: Request, guest: boolean): AllieOwnerProof {
  if (!guest) return { kind: "account", actor: req.actor! };
  const csrf = req.get("x-csrf-token");
  return { kind: "guest", token: cookie(req), ...(csrf ? { csrf } : {}) };
}
function handle(work: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader("Cache-Control", "private, no-store");
      res.vary("Cookie");
      const data = await work(req, res);
      if (!res.destroyed) res.json(successResponse("Allie help", req.id, data));
    } catch (error) {
      next(mapFailure(error));
    }
  };
}
export function createAllieRouter() {
  const router = Router();
  for (const [prefix, guest] of [
    ["/public/learning/assistant", true],
    ["/learning/assistant", false],
  ] as const) {
    router.use(prefix, (_req, _res, next) => {
      try {
        requireAllieEnabled();
        next();
      } catch (error) {
        next(mapFailure(error));
      }
    });
    if (!guest) router.use(prefix, authenticate());
    const writeGuard = guest ? requireTrustedOrigin : requireCsrf;
    if (guest)
      router.post(
        prefix + "/session",
        requireTrustedOrigin,
        validate({ body: allieEmptySchema, query: allieEmptySchema }),
        handle(async (req, res) => {
          const issued = await bootstrapAllieGuest(
            req.ip ?? req.socket.remoteAddress ?? "unknown",
            cookie(req),
          );
          res.cookie(allieGuestCookieName, issued.token, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            expires: issued.expiresAt,
          });
          return {
            csrfToken: issued.csrfToken,
            expiresAt: issued.expiresAt.toISOString(),
          };
        }),
      );
    router.get(
      prefix + "/conversations",
      validate({ query: allieEmptySchema }),
      handle(async (req) => ({ items: await listAllieConversations(proof(req, guest)) })),
    );
    router.post(
      prefix + "/conversations",
      writeGuard,
      validate({ body: allieCreateSchema, query: allieEmptySchema }),
      handle((req) =>
        createAllieConversation(
          proof(req, guest),
          allieCreateSchema.parse(req.body).operationId,
        ),
      ),
    );
    router.get(
      prefix + "/conversations/:conversationId",
      validate({ params: allieConversationParams, query: allieEmptySchema }),
      handle((req) =>
        readAllieConversation(
          proof(req, guest),
          allieConversationParams.parse(req.params).conversationId,
        ),
      ),
    );
    router.delete(
      prefix + "/conversations/:conversationId",
      writeGuard,
      validate({
        params: allieConversationParams,
        query: allieEmptySchema,
        body: allieEmptySchema,
      }),
      handle((req) =>
        clearAllieConversation(
          proof(req, guest),
          allieConversationParams.parse(req.params).conversationId,
        ),
      ),
    );
    router.post(
      prefix + "/conversations/:conversationId/cancel",
      writeGuard,
      validate({
        params: allieConversationParams,
        query: allieEmptySchema,
        body: allieCreateSchema,
      }),
      handle((req) =>
        cancelAllieTurn(
          proof(req, guest),
          allieConversationParams.parse(req.params).conversationId,
          allieCreateSchema.parse(req.body).operationId,
        ),
      ),
    );
    router.post(
      prefix + "/conversations/:conversationId/turns",
      writeGuard,
      validate({
        params: allieConversationParams,
        query: allieEmptySchema,
        body: allieTurnSchema,
      }),
      handle(async (req, res) => {
        const stop = new AbortController(),
          disconnected = () => {
            if (!res.writableEnded) stop.abort();
          };
        res.on("close", disconnected);
        try {
          return await submitAllieTurn(
            proof(req, guest),
            allieConversationParams.parse(req.params).conversationId,
            allieTurnSchema.parse(req.body),
            stop.signal,
            req.ip ?? req.socket.remoteAddress ?? "unknown",
          );
        } finally {
          res.off("close", disconnected);
        }
      }),
    );
  }
  return router;
}
