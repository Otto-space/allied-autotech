import { Router } from "express";
import { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import {
  handoffDraftSchema,
  handoffSubmitSchema,
  handoffHeadersSchema,
  handoffReceiptParamsSchema,
  handoffPreviewHeadersSchema,
} from "./support-handoff.schemas.js";
import {
  previewCustomerHandoff,
  submitCustomerHandoff,
  customerHandoffReceipt,
  recoverCustomerHandoff,
  cancelCustomerHandoff,
} from "./support-handoff.js";

/** Mounted after the canonical customer router's authentication/customer guard. */
export function customerHandoffRouter() {
  const router = Router(),
    query = z.strictObject({});
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.post(
    "/preview",
    requireCsrf,
    createSensitiveRateLimit(60, 3600000),
    validate({ body: handoffDraftSchema, headers: handoffPreviewHeadersSchema, query }),
    async (req, res) => {
      const data = await previewCustomerHandoff(
        req.actor as AuthenticatedActor,
        handoffDraftSchema.parse(res.locals.validated?.["body"]),
        handoffPreviewHeadersSchema.parse(res.locals.validated?.["headers"])[
          "idempotency-key"
        ],
      );
      res.json(
        successResponse("Review the exact queued Customer Care message", req.id, data),
      );
    },
  );
  router.post(
    "/",
    requireCsrf,
    createSensitiveRateLimit(20, 3600000),
    validate({ body: handoffSubmitSchema, headers: handoffHeadersSchema, query }),
    async (req, res) => {
      const data = await submitCustomerHandoff(
        req.actor as AuthenticatedActor,
        handoffSubmitSchema.parse(res.locals.validated?.["body"]),
        handoffHeadersSchema.parse(res.locals.validated?.["headers"])["idempotency-key"],
        {
          requestId: String(req.id),
          ipAddress: req.ip ?? null,
          userAgent: req.get("user-agent") ?? null,
        },
      );
      res.status(201).json(successResponse("Customer Care message saved", req.id, data));
    },
  );
  router.get(
    "/receipts/:operationKey",
    createSensitiveRateLimit(60, 3600000),
    validate({ params: handoffReceiptParamsSchema, query }),
    async (req, res) => {
      const { operationKey } = handoffReceiptParamsSchema.parse(
        res.locals.validated?.["params"],
      );
      const data = await customerHandoffReceipt(
        req.actor as AuthenticatedActor,
        operationKey,
      );
      res.json(successResponse("Saved handoff reference verified", req.id, data));
    },
  );
  router.get(
    "/drafts/:operationKey",
    createSensitiveRateLimit(60, 3600000),
    validate({ params: handoffReceiptParamsSchema, query }),
    async (req, res) => {
      const { operationKey } = handoffReceiptParamsSchema.parse(
        res.locals.validated?.["params"],
      );
      res.json(
        successResponse(
          "Reviewed handoff recovery checked",
          req.id,
          await recoverCustomerHandoff(req.actor as AuthenticatedActor, operationKey),
        ),
      );
    },
  );
  router.delete(
    "/drafts/:operationKey",
    requireCsrf,
    createSensitiveRateLimit(30, 3600000),
    validate({
      params: handoffReceiptParamsSchema,
      body: z.strictObject({}).default({}),
      query,
    }),
    async (req, res) => {
      const { operationKey } = handoffReceiptParamsSchema.parse(
        res.locals.validated?.["params"],
      );
      res.json(
        successResponse(
          "Handoff operation checked or cancelled",
          req.id,
          await cancelCustomerHandoff(req.actor as AuthenticatedActor, operationKey),
        ),
      );
    },
  );
  return router;
}
