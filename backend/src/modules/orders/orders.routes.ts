import {
  registerBuyerSupplyRoutes,
  registerStaffSupplyRoutes,
} from "./order-supply-exception.routes.js";
import {
  registerBuyerPickupRoutes,
  registerStaffPickupRoutes,
} from "./order-pickup.routes.js";
import { orderTimingBodySchema } from "./order-timing.schemas.js";
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
  purchaseReviewRequestSchema,
  purchaseReviewDecisionSchema,
} from "./purchase-review.schemas.js";
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
  registerBuyerPickupRoutes(router);
  registerBuyerSupplyRoutes(router);
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
  router.post(
    "/:orderId/purchase-review",
    requireCsrf,
    validate({
      params: orderParamsSchema,
      body: purchaseReviewRequestSchema,
      query: ordersEmptyQuerySchema,
    }),
    controller.customerRequestPurchaseReview,
  );
  return router;
}
export function createStaffOrdersRouter(): Router {
  const router = Router();
  const controller = new OrdersController();
  router.use(authenticate(), requireStaff);
  registerStaffPickupRoutes(router);
  registerStaffSupplyRoutes(router);
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
    "/:orderId/timing",
    requireCsrf,
    validate({
      params: orderParamsSchema,
      body: orderTimingBodySchema,
      query: ordersEmptyQuerySchema,
    }),
    controller.updateTiming,
  );
  router.post(
    "/:orderId/purchase-review/decision",
    requireCsrf,
    validate({
      params: orderParamsSchema,
      body: purchaseReviewDecisionSchema,
      query: ordersEmptyQuerySchema,
    }),
    controller.decidePurchaseReview,
  );
  router.post(
    "/expire",
    requireCsrf,
    validate({ body: expireOrdersBodySchema, query: ordersEmptyQuerySchema }),
    controller.expire,
  );
  return router;
}
