import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireAdministrator,
  requireCustomer,
  requireStaff,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { PaymentsController } from "./payments.controller.js";
import {
  attemptParamsSchema,
  manualPaymentBodySchema,
  manualReviewBodySchema,
  monnifyWebhookHeadersSchema,
  paymentCreateBodySchema,
  paymentIdempotencyHeadersSchema,
  paymentEvidenceUploadBodySchema,
  paymentListQuerySchema,
  paymentParamsSchema,
  paymentsEmptySchema,
  refundCreateBodySchema,
  refundDecisionBodySchema,
  refundParamsSchema,
  staffPaymentListQuerySchema,
  webhookHeadersSchema,
} from "./payments.schemas.js";

export function createCustomerPaymentsRouter(): Router {
  const router = Router();
  const controller = new PaymentsController();
  router.use(authenticate(), requireCustomer);
  router.get("/", validate({ query: paymentListQuerySchema }), controller.customerList);
  router.post(
    "/",
    requireCsrf,
    createSensitiveRateLimit(30),
    validate({
      headers: paymentIdempotencyHeadersSchema,
      body: paymentCreateBodySchema,
      query: paymentsEmptySchema,
    }),
    controller.create,
  );
  router.get(
    "/:paymentId",
    validate({ params: paymentParamsSchema, query: paymentsEmptySchema }),
    controller.customerGet,
  );
  router.post(
    "/:paymentId/paystack",
    requireCsrf,
    createSensitiveRateLimit(20),
    validate({
      params: paymentParamsSchema,
      headers: paymentIdempotencyHeadersSchema,
      body: paymentsEmptySchema,
      query: paymentsEmptySchema,
    }),
    controller.initialize,
  );
  router.post(
    "/:paymentId/monnify",
    requireCsrf,
    createSensitiveRateLimit(20),
    validate({
      params: paymentParamsSchema,
      headers: paymentIdempotencyHeadersSchema,
      body: paymentsEmptySchema,
      query: paymentsEmptySchema,
    }),
    controller.initializeMonnify,
  );
  router.post(
    "/:paymentId/attempts/:attemptId/verify",
    requireCsrf,
    createSensitiveRateLimit(30),
    validate({
      params: attemptParamsSchema,
      body: paymentsEmptySchema,
      query: paymentsEmptySchema,
    }),
    controller.verify,
  );
  router.post(
    "/:paymentId/manual",
    requireCsrf,
    createSensitiveRateLimit(10),
    validate({
      params: paymentParamsSchema,
      headers: paymentIdempotencyHeadersSchema,
      body: manualPaymentBodySchema,
      query: paymentsEmptySchema,
    }),
    controller.manual,
  );
  router.post(
    "/:paymentId/manual-evidence/upload",
    requireCsrf,
    createSensitiveRateLimit(10),
    validate({
      params: paymentParamsSchema,
      body: paymentEvidenceUploadBodySchema,
      query: paymentsEmptySchema,
    }),
    controller.evidenceUpload,
  );
  return router;
}
export function createStaffPaymentsRouter(): Router {
  const router = Router();
  const controller = new PaymentsController();
  router.use(authenticate(), requireStaff);
  router.get("/", validate({ query: staffPaymentListQuerySchema }), controller.staffList);
  router.post(
    "/manual-attempts/:attemptId/review",
    requireAdministrator,
    requireCsrf,
    validate({
      params: attemptParamsSchema.pick({ attemptId: true }),
      body: manualReviewBodySchema,
      query: paymentsEmptySchema,
    }),
    controller.reviewManual,
  );
  router.post(
    "/manual-attempts/:attemptId/evidence-access",
    requireCsrf,
    validate({
      params: attemptParamsSchema.pick({ attemptId: true }),
      body: paymentsEmptySchema,
      query: paymentsEmptySchema,
    }),
    controller.manualEvidence,
  );
  router.post(
    "/refunds",
    requireCsrf,
    validate({
      headers: paymentIdempotencyHeadersSchema,
      body: refundCreateBodySchema,
      query: paymentsEmptySchema,
    }),
    controller.requestRefund,
  );
  router.post(
    "/refunds/:refundId/decision",
    requireAdministrator,
    requireCsrf,
    validate({
      params: refundParamsSchema,
      body: refundDecisionBodySchema,
      query: paymentsEmptySchema,
    }),
    controller.decideRefund,
  );
  return router;
}
export function createPaystackWebhookRouter(): Router {
  const router = Router();
  const controller = new PaymentsController();
  router.post(
    "/",
    createSensitiveRateLimit(300, 60_000),
    validate({ headers: webhookHeadersSchema }),
    controller.webhook,
  );
  return router;
}

export function createMonnifyWebhookRouter(): Router {
  const router = Router();
  const controller = new PaymentsController();
  router.post(
    "/",
    createSensitiveRateLimit(300, 60_000),
    validate({ headers: monnifyWebhookHeadersSchema }),
    controller.monnifyWebhook,
  );
  return router;
}
