import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireCustomer,
  requireAdministrator,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { BillingController } from "./billing.controller.js";
import {
  invoiceDocument,
  invoiceDownload,
  staffInvoiceDocument,
  staffInvoiceDownload,
} from "./documents.controller.js";
import { staffInvoiceDownloadQuerySchema } from "./document.schemas.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import {
  billingEmptyQuerySchema,
  customerInvoiceListQuerySchema,
  invoiceCreateBodySchema,
  invoiceParamsSchema,
  invoiceTransitionBodySchema,
  staffInvoiceListQuerySchema,
  invoiceSourceListQuerySchema,
} from "./billing.schemas.js";
export function createCustomerBillingRouter(): Router {
  const router = Router();
  const controller = new BillingController();
  router.use(authenticate(), requireCustomer);
  router.get(
    "/:invoiceId/document",
    validate({ params: invoiceParamsSchema, query: billingEmptyQuerySchema }),
    invoiceDocument,
  );
  router.get(
    "/:invoiceId/download",
    createSensitiveRateLimit(20),
    validate({ params: invoiceParamsSchema, query: billingEmptyQuerySchema }),
    invoiceDownload,
  );
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
  router.use(authenticate(), requireAdministrator);
  router.get(
    "/:invoiceId/document",
    validate({ params: invoiceParamsSchema, query: billingEmptyQuerySchema }),
    staffInvoiceDocument,
  );
  router.get(
    "/:invoiceId/download",
    createSensitiveRateLimit(20),
    validate({ params: invoiceParamsSchema, query: staffInvoiceDownloadQuerySchema }),
    staffInvoiceDownload,
  );
  router.get("/", validate({ query: staffInvoiceListQuerySchema }), controller.staffList);
  router.get(
    "/sources",
    validate({ query: invoiceSourceListQuerySchema }),
    controller.invoiceSources,
  );
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
