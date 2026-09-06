import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireAdministrator,
  requireCustomer,
  requireStaff,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { OrdersController } from "./orders.controller.js";
import {
  checkoutBodySchema,
  customerOrderCancelBodySchema,
  customerOrderListQuerySchema,
  expireOrdersBodySchema,
  orderIdempotencyHeadersSchema,
  orderParamsSchema,
  orderTransitionBodySchema,
  ordersEmptyQuerySchema,
  staffOrderListQuerySchema,
} from "./orders.schemas.js";

export function createCustomerOrdersRouter(): Router {
  const router = Router();
  const controller = new OrdersController();
  router.use(authenticate(), requireCustomer);
  router.post(
    "/checkout",
    requireCsrf,
    validate({
      headers: orderIdempotencyHeadersSchema,
      body: checkoutBodySchema,
      query: ordersEmptyQuerySchema,
    }),
    controller.checkout,
  );
  router.get(
    "/",
    validate({ query: customerOrderListQuerySchema }),
    controller.customerList,
  );
  router.get(
    "/:orderId",
    validate({ params: orderParamsSchema, query: ordersEmptyQuerySchema }),
    controller.customerGet,
  );
  router.post(
    "/:orderId/cancel",
    requireCsrf,
    validate({
      params: orderParamsSchema,
      body: customerOrderCancelBodySchema,
      query: ordersEmptyQuerySchema,
    }),
    controller.customerCancel,
  );
  return router;
}
export function createStaffOrdersRouter(): Router {
  const router = Router();
  const controller = new OrdersController();
  router.use(authenticate(), requireStaff);
  router.get("/", validate({ query: staffOrderListQuerySchema }), controller.staffList);
  router.get(
    "/:orderId",
    validate({ params: orderParamsSchema, query: ordersEmptyQuerySchema }),
    controller.staffGet,
  );
  router.post(
    "/:orderId/status",
    requireCsrf,
    validate({
      params: orderParamsSchema,
      body: orderTransitionBodySchema,
      query: ordersEmptyQuerySchema,
    }),
    controller.transition,
  );
  return router;
}
export function createAdminOrderOperationsRouter(): Router {
  const router = Router();
  const controller = new OrdersController();
  router.use(authenticate(), requireAdministrator);
  router.post(
    "/expire",
    requireCsrf,
    validate({ body: expireOrdersBodySchema, query: ordersEmptyQuerySchema }),
    controller.expire,
  );
  return router;
}
