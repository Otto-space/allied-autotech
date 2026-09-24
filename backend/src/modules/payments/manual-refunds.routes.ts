import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import { ManualRefundsService } from "./manual-refunds.service.js";
import {
  paymentEvidenceUploadBodySchema,
  refundDecisionBodySchema,
} from "./payments.schemas.js";
import { paymentsService } from "./payments.service.js";
import { refundListQuerySchema, type RefundListQuery } from "../audit/audit.schemas.js";

const params = z.object({ refundId: z.uuid() });
export const transfer = z
  .object({
    bankReference: z.string().trim().min(3).max(160),
    transferredAt: z.iso.datetime(),
    evidenceToken: z.string().min(20).max(8000),
    beneficiary: z
      .object({
        bankName: z.string().trim().min(2).max(120),
        accountName: z.string().trim().min(2).max(160),
        accountNumber: z.string().regex(/^\d{10}$/),
      })
      .strict(),
  })
  .strict();
export const check = z
  .object({
    accepted: z.boolean(),
    note: z.string().trim().min(10).max(1000),
    evidenceChecked: z.literal(true),
  })
  .strict();
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const id = (res: Response) =>
  (res.locals.validated!["params"] as { refundId: string }).refundId;

export function createManualRefundsRouter() {
  const router = Router();
  const service = new ManualRefundsService();
  router.use(authenticate(), requireStaff);
  router.get("/", validate({ query: refundListQuerySchema }), async (req, res) => {
    res.json(
      successResponse(
        "Permitted refund queue",
        req.id,
        await service.list(
          req.actor!,
          res.locals.validated!["query"] as RefundListQuery,
          context(req),
        ),
      ),
    );
  });
  router.use(requireCsrf);
  router.post(
    "/:refundId/decision",
    validate({ params, body: refundDecisionBodySchema }),
    async (req, res) =>
      res.json(
        successResponse(
          "Refund decision recorded",
          req.id,
          await paymentsService.decideRefund(
            req.actor!,
            id(res),
            res.locals.validated!["body"] as z.infer<typeof refundDecisionBodySchema>,
            context(req),
          ),
        ),
      ),
  );
  router.post(
    "/:refundId/evidence-upload",
    validate({ params, body: paymentEvidenceUploadBodySchema }),
    async (req, res) =>
      res.json(
        successResponse(
          "Evidence upload issued",
          req.id,
          await service.evidenceUpload(
            req.actor!,
            id(res),
            res.locals.validated!["body"] as z.infer<
              typeof paymentEvidenceUploadBodySchema
            >,
          ),
        ),
      ),
  );
  router.post(
    "/:refundId/transfer",
    validate({ params, body: transfer }),
    async (req, res) =>
      res.json(
        successResponse(
          "Transfer recorded; independent checking required",
          req.id,
          await service.recordTransfer(
            req.actor!,
            id(res),
            res.locals.validated!["body"] as z.infer<typeof transfer>,
            context(req),
          ),
        ),
      ),
  );
  router.post(
    "/:refundId/evidence-access",
    validate({ params, body: z.object({}).strict() }),
    async (req, res) =>
      res.json(
        successResponse(
          "Evidence access issued",
          req.id,
          await service.evidenceAccess(req.actor!, id(res), context(req)),
        ),
      ),
  );
  router.post("/:refundId/check", validate({ params, body: check }), async (req, res) => {
    const input = res.locals.validated!["body"] as z.infer<typeof check>;
    res.json(
      successResponse(
        "Refund check recorded",
        req.id,
        await service.check(
          req.actor!,
          id(res),
          input.accepted,
          input.note,
          context(req),
        ),
      ),
    );
  });
  return router;
}
