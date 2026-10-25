import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCustomer, requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { NotificationsController } from "./notifications.controller.js";
import { PushService } from "./push.service.js";
import { pushSubscriptionSchema } from "./push.schemas.js";
import { successResponse } from "../../common/http/api-response.js";
import {
  notificationListQuerySchema,
  notificationAttentionQuerySchema,
  notificationContextQuerySchema,
  notificationContextReadSchema,
  notificationParamsSchema,
  notificationsEmptyBodySchema,
  notificationsEmptyQuerySchema,
  preferenceUpdateBodySchema,
  preferenceRequestHeadersSchema,
} from "./notifications.schemas.js";

function routes(): Router {
  const router = Router();
  const controller = new NotificationsController();
  const push = new PushService();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
  router.get(
    "/push",
    validate({ query: notificationsEmptyQuerySchema }),
    async (req, res) => {
      res.setHeader("Cache-Control", "private, no-store");
      res.json(
        successResponse(
          "Browser notification settings",
          req.id,
          await push.status(req.actor!),
        ),
      );
    },
  );
  router.put(
    "/push",
    requireCsrf,
    validate({ body: pushSubscriptionSchema, query: notificationsEmptyQuerySchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Browser notifications enabled",
          req.id,
          await push.subscribe(req.actor!, res.locals.validated?.["body"]),
        ),
      );
    },
  );
  router.delete(
    "/push",
    requireCsrf,
    validate({
      body: notificationsEmptyBodySchema,
      query: notificationsEmptyQuerySchema,
    }),
    async (req, res) => {
      res.json(
        successResponse(
          "Browser notifications disabled",
          req.id,
          await push.unsubscribe(req.actor!),
        ),
      );
    },
  );
  router.get("/", validate({ query: notificationListQuerySchema }), controller.list);
  router.get(
    "/summary",
    validate({ query: notificationsEmptyQuerySchema }),
    controller.summary,
  );
  router.get(
    "/attention",
    validate({ query: notificationAttentionQuerySchema }),
    controller.attention,
  );
  router.get(
    "/context",
    validate({ query: notificationContextQuerySchema }),
    controller.context,
  );
  router.post(
    "/read-context",
    requireCsrf,
    validate({
      body: notificationContextReadSchema,
      query: notificationsEmptyQuerySchema,
    }),
    controller.readContext,
  );
  router.post(
    "/read-all",
    requireCsrf,
    validate({
      body: notificationsEmptyBodySchema,
      query: notificationsEmptyQuerySchema,
    }),
    controller.markAllRead,
  );
  router.post(
    "/:notificationId/unread",
    requireCsrf,
    validate({
      params: notificationParamsSchema,
      body: notificationsEmptyBodySchema,
      query: notificationsEmptyQuerySchema,
    }),
    controller.markUnread,
  );
  router.post(
    "/:notificationId/read",
    requireCsrf,
    validate({
      params: notificationParamsSchema,
      body: notificationsEmptyBodySchema,
      query: notificationsEmptyQuerySchema,
    }),
    controller.markRead,
  );
  router.get(
    "/preferences/current",
    validate({ query: notificationsEmptyQuerySchema }),
    controller.preferences,
  );
  router.put(
    "/preferences/current",
    requireCsrf,
    validate({
      body: preferenceUpdateBodySchema,
      query: notificationsEmptyQuerySchema,
      headers: preferenceRequestHeadersSchema,
    }),
    controller.updatePreference,
  );
  router.get(
    "/:notificationId",
    validate({ params: notificationParamsSchema, query: notificationsEmptyQuerySchema }),
    controller.detail,
  );
  return router;
}

export function createCustomerNotificationsRouter(): Router {
  const router = Router();
  router.use(authenticate(), requireCustomer, routes());
  return router;
}

export function createStaffNotificationsRouter(): Router {
  const router = Router();
  router.use(authenticate(), requireStaff, routes());
  return router;
}
