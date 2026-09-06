import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCustomer, requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { BillingController } from "./billing.controller.js";
import {
  billingEmptyQuerySchema,
  customerInvoiceListQuerySchema,
  invoiceCreateBodySchema,
  invoiceParamsSchema,
  invoiceTransitionBodySchema,
  staffInvoiceListQuerySchema,
} from "./billing.schemas.js";
export function createCustomerBillingRouter(): Router {
  const router = Router();
  const controller = new BillingController();
  router.use(authenticate(), requireCustomer);
  router.get(
    "/",
    validate({ query: customerInvoiceListQuerySchema }),
    controller.customerList,
  );
  router.get(
    "/:invoiceId",
    validate({ params: invoiceParamsSchema, query: billingEmptyQuerySchema }),
    controller.customerGet,
  );
  return router;
}
export function createStaffBillingRouter(): Router {
  const router = Router();
  const controller = new BillingController();
  router.use(authenticate(), requireStaff);
  router.get("/", validate({ query: staffInvoiceListQuerySchema }), controller.staffList);
  router.get(
    "/:invoiceId",
    validate({ params: invoiceParamsSchema, query: billingEmptyQuerySchema }),
    controller.staffGet,
  );
  router.post(
    "/",
    requireCsrf,
    validate({ body: invoiceCreateBodySchema, query: billingEmptyQuerySchema }),
    controller.create,
  );
  router.post(
    "/:invoiceId/issue",
    requireCsrf,
    validate({
      params: invoiceParamsSchema,
      body: invoiceTransitionBodySchema,
      query: billingEmptyQuerySchema,
    }),
    controller.issue,
  );
  router.post(
    "/:invoiceId/void",
    requireCsrf,
    validate({
      params: invoiceParamsSchema,
      body: invoiceTransitionBodySchema,
      query: billingEmptyQuerySchema,
    }),
    controller.void,
  );
  return router;
}
