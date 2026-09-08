import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCustomer, requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { NotificationsController } from "./notifications.controller.js";
import {
  notificationListQuerySchema,
  notificationParamsSchema,
  notificationsEmptyBodySchema,
  notificationsEmptyQuerySchema,
  preferenceUpdateBodySchema,
} from "./notifications.schemas.js";

function routes(): Router {
  const router = Router();
  const controller = new NotificationsController();
  router.get("/", validate({ query: notificationListQuerySchema }), controller.list);
  router.post(
    "/read-all",
    requireCsrf,
    validate({ body: notificationsEmptyBodySchema, query: notificationsEmptyQuerySchema }),
    controller.markAllRead,
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
    validate({ body: preferenceUpdateBodySchema, query: notificationsEmptyQuerySchema }),
    controller.updatePreference,
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
