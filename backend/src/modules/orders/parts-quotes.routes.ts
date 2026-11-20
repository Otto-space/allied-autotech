import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireAdministrator,
  requireCustomer,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import { prisma } from "../../config/database.js";
import { supportNotFound } from "../support/support.errors.js";
import { ordersService } from "./orders.service.js";
import { orderIdempotencyHeadersSchema } from "./orders.schemas.js";
import {
  issuePartsQuoteSchema,
  partsQuoteDecisionSchema,
  partsQuotesService,
} from "./parts-quotes.service.js";
import type { Request } from "express";
const params = z.object({ id: z.uuid() }).strict();
const empty = z.object({}).strict();
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
export function partsQuotesRouter(staff = false) {
  const router = Router();
  router.use(authenticate(), staff ? requireAdministrator : requireCustomer);
  router.get("/enquiries/:id", validate({ params, query: empty }), async (req, res) => {
    const { id } = params.parse(res.locals.validated?.["params"]);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(
      successResponse(
        "Parts quotations",
        req.id,
        await partsQuotesService.list(req.actor!, id, context(req)),
      ),
    );
  });
  if (staff)
    router.post(
      "/enquiries/:id",
      requireCsrf,
      createSensitiveRateLimit(30, 60 * 60000),
      validate({
        params,
        body: issuePartsQuoteSchema,
        headers: orderIdempotencyHeadersSchema,
        query: empty,
      }),
      async (req, res) => {
        const { id } = params.parse(res.locals.validated?.["params"]);
        const body = issuePartsQuoteSchema.parse(res.locals.validated?.["body"]);
        const headers = orderIdempotencyHeadersSchema.parse(
          res.locals.validated?.["headers"],
        );
        res
          .status(201)
          .json(
            successResponse(
              "Quotation issued",
              req.id,
              await partsQuotesService.issue(
                req.actor!,
                id,
                body,
                headers["idempotency-key"],
                context(req),
              ),
            ),
          );
      },
    );
  else {
    router.post(
      "/:id/decline",
      requireCsrf,
      validate({ params, body: partsQuoteDecisionSchema, query: empty }),
      async (req, res) => {
        const { id } = params.parse(res.locals.validated?.["params"]);
        const { revision } = partsQuoteDecisionSchema.parse(
          res.locals.validated?.["body"],
        );
        res.json(
          successResponse(
            "Quotation declined",
            req.id,
            await partsQuotesService.decline(req.actor!, id, revision, context(req)),
          ),
        );
      },
    );
    router.post(
      "/:id/accept",
      requireCsrf,
      createSensitiveRateLimit(20, 60 * 60000),
      validate({
        params,
        body: partsQuoteDecisionSchema,
        headers: orderIdempotencyHeadersSchema,
        query: empty,
      }),
      async (req, res) => {
        const { id } = params.parse(res.locals.validated?.["params"]);
        const { revision, alternativeAgreementVersion } = partsQuoteDecisionSchema.parse(
          res.locals.validated?.["body"],
        );
        const headers = orderIdempotencyHeadersSchema.parse(
          res.locals.validated?.["headers"],
        );
        const quote = await prisma.partsQuote.findUnique({
          where: { id },
          select: {
            enquiry: {
              select: { branchId: true, customer: { select: { userId: true } } },
            },
          },
        });
        if (
          !quote?.enquiry.branchId ||
          quote.enquiry.customer?.userId !== req.actor!.userId
        )
          throw supportNotFound();
        res
          .status(201)
          .json(
            successResponse(
              "Quotation accepted; payment is pending",
              req.id,
              await ordersService.checkout(
                req.actor!,
                { branchId: quote.enquiry.branchId, fulfillmentMethod: "COLLECTION" },
                headers["idempotency-key"],
                context(req),
                {
                  id,
                  revision,
                  ...(alternativeAgreementVersion ? { alternativeAgreementVersion } : {}),
                },
              ),
            ),
          );
      },
    );
  }
  return router;
}
