import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireAdministrator } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { AuditController } from "./audit.controller.js";
import {
  anomalyListQuerySchema,
  anomalyParamsSchema,
  anomalyUpdateBodySchema,
  auditListQuerySchema,
  disputeListQuerySchema,
  operationalJobParamsSchema,
  operationalJobsQuerySchema,
  operationalRetryBodySchema,
  operationsEmptyQuerySchema,
  refundListQuerySchema,
} from "./audit.schemas.js";

export function createAuditOperationsRouter(): Router {
  const router = Router();
  const controller = new AuditController();
  router.use(authenticate(), requireAdministrator);
  router.get("/audit", validate({ query: auditListQuerySchema }), controller.list);
  router.get(
    "/operations/status",
    validate({ query: operationsEmptyQuerySchema }),
    controller.status,
  );
  router.get(
    "/operations/jobs",
    validate({ query: operationalJobsQuerySchema }),
    controller.jobs,
  );
  router.post(
    "/operations/jobs/:source/:jobId/retry",
    requireCsrf,
    createSensitiveRateLimit(20, 60 * 60_000),
    validate({
      params: operationalJobParamsSchema,
      body: operationalRetryBodySchema,
      query: operationsEmptyQuerySchema,
    }),
    controller.retry,
  );
  router.get(
    "/operations/payment-anomalies",
    validate({ query: anomalyListQuerySchema }),
    controller.anomalies,
  );
  router.get(
    "/operations/payment-disputes",
    validate({ query: disputeListQuerySchema }),
    controller.disputes,
  );
  router.get(
    "/operations/payment-refunds",
    validate({ query: refundListQuerySchema }),
    controller.refunds,
  );
  router.post(
    "/operations/payment-anomalies/:anomalyId/status",
    requireCsrf,
    validate({
      params: anomalyParamsSchema,
      body: anomalyUpdateBodySchema,
      query: operationsEmptyQuerySchema,
    }),
    controller.updateAnomaly,
  );
  return router;
}
