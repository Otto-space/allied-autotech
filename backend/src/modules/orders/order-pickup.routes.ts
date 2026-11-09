import type { Request, Response, Router } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { successResponse } from "../../common/http/api-response.js";
import { requireCsrf, requireTrustedOrigin } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { purchaseCookieName } from "../../common/security/cookies.js";
import { OrderPickupService } from "./order-pickup.service.js";
import { orderParamsSchema, ordersEmptyQuerySchema } from "./orders.schemas.js";
import { purchaseCsrfHeadersSchema } from "./purchase.schemas.js";
import {
  pickupIssueSchema,
  pickupRevokeSchema,
  pickupVerifySchema,
  pickupHandoverSchema,
  pickupCancelClaimSchema,
  collectionNoticeSchema,
  collectionExtensionSchema,
} from "./order-pickup.schemas.js";

const value = (res: Response, key: string) => res.locals.validated?.[key];
const orderId = (res: Response) => (value(res, "params") as { orderId: string }).orderId;
const actor = (req: Request) => req.actor as AuthenticatedActor;
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const send = (req: Request, res: Response, data: unknown) =>
  res
    .set("Cache-Control", "private, no-store")
    .json(
      successResponse(
        "Private collection access checked; payment and physical handover remain separate",
        req.id,
        data,
      ),
    );

/** Mount after the existing account/customer middleware or private guest cookie
 * conflict guard. Service transactions independently recheck the current principal. */
export function registerBuyerPickupRoutes(router: Router, guest = false) {
  const service = new OrderPickupService(),
    prefix = guest ? "/orders/:orderId/pickup" : "/:orderId/pickup";
  const buyer = (req: Request) =>
    guest
      ? {
          kind: "guest" as const,
          sessionToken:
            typeof req.cookies?.[purchaseCookieName] === "string"
              ? (req.cookies[purchaseCookieName] as string)
              : "",
          csrfToken: req.get("x-csrf-token") ?? "",
        }
      : { kind: "account" as const, actor: actor(req) };
  const params = { params: orderParamsSchema, query: ordersEmptyQuerySchema };
  router.get(
    prefix,
    createSensitiveRateLimit(30, 60000),
    validate(params),
    async (req, res) => send(req, res, await service.read(buyer(req), orderId(res))),
  );
  for (const [suffix, body, operation] of [
    ["", pickupIssueSchema, "issue"],
    ["/revoke", pickupRevokeSchema, "revoke"],
  ] as const)
    router.post(
      prefix + suffix,
      createSensitiveRateLimit(10, 60000),
      guest ? requireTrustedOrigin : requireCsrf,
      validate({
        ...params,
        body,
        ...(guest ? { headers: purchaseCsrfHeadersSchema } : {}),
      }),
      async (req, res) =>
        send(
          req,
          res,
          await service[operation](
            buyer(req),
            orderId(res),
            value(res, "body"),
            context(req),
          ),
        ),
    );
}
/** Mount only after authenticate/requireStaff; current MFA and branch are also
 * rechecked under locks by every service operation. Codes never enter URLs. */
export function registerStaffPickupRoutes(router: Router) {
  const service = new OrderPickupService(),
    params = { params: orderParamsSchema, query: ordersEmptyQuerySchema };
  router.get(
    "/:orderId/pickup",
    createSensitiveRateLimit(30, 60000),
    validate(params),
    async (req, res) =>
      send(req, res, await service.readStaff(actor(req), orderId(res), context(req))),
  );
  router.post(
    "/:orderId/pickup/verify",
    createSensitiveRateLimit(10, 60000),
    requireCsrf,
    validate({ ...params, body: pickupVerifySchema }),
    async (req, res) =>
      send(req, res, await service.verify(actor(req), orderId(res), value(res, "body"))),
  );
  for (const [suffix, body, operation] of [
    ["contact", collectionNoticeSchema, "collectionContact"],
    ["extend-hold", collectionExtensionSchema, "extendCollectionHold"],
  ] as const)
    router.post(
      `/:orderId/pickup/${suffix}`,
      createSensitiveRateLimit(10, 60000),
      requireCsrf,
      validate({ ...params, body }),
      async (req, res) =>
        send(
          req,
          res,
          await service[operation](
            actor(req),
            orderId(res),
            value(res, "body"),
            context(req),
          ),
        ),
    );
  router.post(
    "/:orderId/pickup/cancel-review",
    createSensitiveRateLimit(10, 60000),
    requireCsrf,
    validate({ ...params, body: pickupCancelClaimSchema }),
    async (req, res) =>
      send(
        req,
        res,
        await service.cancelClaim(
          actor(req),
          orderId(res),
          value(res, "body"),
          context(req),
        ),
      ),
  );
  router.post(
    "/:orderId/pickup/handover",
    createSensitiveRateLimit(10, 60000),
    requireCsrf,
    validate({ ...params, body: pickupHandoverSchema }),
    async (req, res) =>
      send(
        req,
        res,
        await service.handover(
          actor(req),
          orderId(res),
          value(res, "body"),
          context(req),
        ),
      ),
  );
}
