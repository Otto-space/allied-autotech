import { Router, type Request } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCustomer, requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import { OrderAftercareService } from "./order-aftercare.service.js";
import { jsonSafe } from "./orders.types.js";
import {
  aftercareParams,
  aftercareReturnBody,
  aftercarePartialBody,
  aftercareReviewBody,
  fulfillmentEvidenceBody,
  customerAftercareView,
} from "./order-aftercare.schemas.js";
import type { z } from "zod";
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
export function createOrderAftercareRouter() {
  const router = Router(),
    service = new OrderAftercareService();
  router.get(
    "/staff/orders/:id/aftercare",
    authenticate(),
    requireStaff,
    validate({ params: aftercareParams }),
    async (req, res) => {
      const { id } = res.locals.validated!["params"] as z.infer<typeof aftercareParams>;
      res.json(
        successResponse(
          "Order review requests",
          req.id,
          jsonSafe(await service.staffList(req.actor!, id)),
        ),
      );
    },
  );
  router.get(
    "/customers/orders/:id/aftercare",
    authenticate(),
    requireCustomer,
    validate({ params: aftercareParams }),
    async (req, res) => {
      const { id } = res.locals.validated!["params"] as z.infer<typeof aftercareParams>;
      res.json(
        successResponse(
          "Order requests",
          req.id,
          jsonSafe(await service.list(req.actor!, id)),
        ),
      );
    },
  );
  router.post(
    "/customers/orders/:id/returns",
    authenticate(),
    requireCustomer,
    requireCsrf,
    validate({ params: aftercareParams, body: aftercareReturnBody }),
    async (req, res) => {
      const { id } = res.locals.validated!["params"] as z.infer<typeof aftercareParams>,
        input = res.locals.validated!["body"] as z.infer<typeof aftercareReturnBody>;
      const record = await service.request(req.actor!, id, input.reason, context(req));
      res
        .status(201)
        .json(
          successResponse(
            "Return request received for review",
            req.id,
            jsonSafe(customerAftercareView(record)),
          ),
        );
    },
  );
  router.post(
    "/customers/orders/:id/aftercare",
    authenticate(),
    requireCustomer,
    requireCsrf,
    validate({ params: aftercareParams, body: aftercarePartialBody }),
    async (req, res) => {
      const { id } = res.locals.validated!["params"] as z.infer<typeof aftercareParams>,
        input = res.locals.validated!["body"] as z.infer<typeof aftercarePartialBody>;
      const record = await service.requestPartial(req.actor!, id, input, context(req));
      res
        .status(201)
        .json(
          successResponse(
            "Order request received for review",
            req.id,
            jsonSafe(customerAftercareView(record)),
          ),
        );
    },
  );
  router.post(
    "/staff/orders/:id/fulfillment-evidence",
    authenticate(),
    requireStaff,
    requireCsrf,
    validate({ params: aftercareParams, body: fulfillmentEvidenceBody }),
    async (req, res) => {
      const { id } = res.locals.validated!["params"] as z.infer<typeof aftercareParams>,
        input = res.locals.validated!["body"] as z.infer<typeof fulfillmentEvidenceBody>;
      res.json(
        successResponse(
          "Fulfillment evidence recorded",
          req.id,
          await service.fulfillmentEvidence(
            req.actor!,
            id,
            input.at,
            input.reference,
            context(req),
          ),
        ),
      );
    },
  );
  router.post(
    "/staff/order-requests/:id/review",
    authenticate(),
    requireStaff,
    requireCsrf,
    validate({ params: aftercareParams, body: aftercareReviewBody }),
    async (req, res) => {
      const { id } = res.locals.validated!["params"] as z.infer<typeof aftercareParams>,
        input = res.locals.validated!["body"] as z.infer<typeof aftercareReviewBody>;
      res.json(
        successResponse(
          "Order request reviewed",
          req.id,
          jsonSafe(await service.process(req.actor!, id, input, context(req))),
        ),
      );
    },
  );
  return router;
}
