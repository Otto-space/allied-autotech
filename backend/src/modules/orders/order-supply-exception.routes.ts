import type { Request, Response, Router } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { successResponse } from "../../common/http/api-response.js";
import { requireAdministrator } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { purchaseCookieName } from "../../common/security/cookies.js";
import { orderParamsSchema, ordersEmptyQuerySchema } from "./orders.schemas.js";
import { OrderSupplyExceptionService } from "./order-supply-exception.service.js";
import { supplyExceptionRaiseSchema } from "./order-supply-exception.schemas.js";
const value = (res: Response, key: string) => res.locals.validated?.[key];
const id = (res: Response) => (value(res, "params") as { orderId: string }).orderId;
const actor = (req: Request) => req.actor as AuthenticatedActor;
const send = (req: Request, res: Response, data: unknown) =>
  res
    .set("Cache-Control", "private, no-store")
    .json(
      successResponse(
        "Supply concern recorded for review; no money moved or remedy approved",
        req.id,
        data,
      ),
    );
export function registerBuyerSupplyRoutes(router: Router, guest = false) {
  const service = new OrderSupplyExceptionService();
  router.get(
    guest ? "/orders/:orderId/supply-exceptions" : "/:orderId/supply-exceptions",
    createSensitiveRateLimit(30, 60000),
    validate({ params: orderParamsSchema, query: ordersEmptyQuerySchema }),
    async (req, res) =>
      send(
        req,
        res,
        await service.read(
          guest
            ? {
                kind: "guest",
                sessionToken:
                  typeof req.cookies?.[purchaseCookieName] === "string"
                    ? req.cookies[purchaseCookieName]
                    : "",
              }
            : { kind: "account", actor: actor(req) },
          id(res),
        ),
      ),
  );
}
export function registerStaffSupplyRoutes(router: Router) {
  const service = new OrderSupplyExceptionService(),
    params = { params: orderParamsSchema, query: ordersEmptyQuerySchema };
  router.get(
    "/:orderId/supply-exceptions",
    createSensitiveRateLimit(30, 60000),
    validate(params),
    async (req, res) =>
      send(
        req,
        res,
        await service.readStaff(actor(req), id(res), {
          requestId: String(req.id),
          ipAddress: req.ip ?? null,
          userAgent: req.get("user-agent") ?? null,
        }),
      ),
  );
  router.post(
    "/:orderId/supply-exceptions",
    createSensitiveRateLimit(10, 60000),
    requireAdministrator,
    requireCsrf,
    validate({ ...params, body: supplyExceptionRaiseSchema }),
    async (req, res) =>
      send(
        req,
        res,
        await service.raise(actor(req), id(res), value(res, "body"), {
          requestId: String(req.id),
          ipAddress: req.ip ?? null,
          userAgent: req.get("user-agent") ?? null,
        }),
      ),
  );
}
