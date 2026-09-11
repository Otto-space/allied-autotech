import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { successResponse } from "../../common/http/api-response.js";
import { assertMonnifyMode, assertPaystackMode, env } from "../../config/env.js";
import {
  parsePaystackWebhook,
  paystackPayloadSha256,
  verifyPaystackSignature,
} from "../../providers/payments/paystack-webhook.js";
import {
  monnifyPayloadSha256,
  parseMonnifyWebhook,
  verifyMonnifySignature,
} from "../../providers/payments/monnify-webhook.js";
import { webhookUnauthorized } from "./payments.errors.js";
import type {
  ManualPaymentInput,
  ManualReviewInput,
  PaymentCreateInput,
  PaymentListQuery,
  PaymentEvidenceUploadInput,
  RefundCreateInput,
  RefundDecisionInput,
  StaffPaymentListQuery,
} from "./payments.schemas.js";
import { paymentsService, type PaymentsService } from "./payments.service.js";

const validated = <T>(res: Response, location: "body" | "params" | "query" | "headers") =>
  res.locals.validated?.[location] as T;
const actor = (req: Request) => req.actor as AuthenticatedActor;
const context = (req: Request): RequestSecurityContext => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const key = (res: Response) =>
  validated<{ "idempotency-key": string }>(res, "headers")["idempotency-key"];

export class PaymentsController {
  constructor(private readonly service: PaymentsService = paymentsService) {}
  create = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Payment created",
          req.id,
          await this.service.createIntent(
            actor(req),
            validated<PaymentCreateInput>(res, "body"),
            key(res),
            context(req),
          ),
        ),
      );
  customerList = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Payments retrieved",
          req.id,
          await this.service.customerList(
            actor(req),
            validated<PaymentListQuery>(res, "query"),
          ),
        ),
      );
  customerGet = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Payment retrieved",
          req.id,
          await this.service.customerGet(
            actor(req),
            validated<{ paymentId: string }>(res, "params").paymentId,
          ),
        ),
      );
  initialize = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Payment initialized",
          req.id,
          await this.service.initializePaystack(
            actor(req),
            validated<{ paymentId: string }>(res, "params").paymentId,
            key(res),
            context(req),
          ),
        ),
      );
  initializeMonnify = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Payment initialized",
          req.id,
          await this.service.initializeMonnify(
            actor(req),
            validated<{ paymentId: string }>(res, "params").paymentId,
            key(res),
            context(req),
          ),
        ),
      );
  evidenceUpload = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Evidence upload authorized",
          req.id,
          await this.service.createEvidenceUpload(
            actor(req),
            validated<{ paymentId: string }>(res, "params").paymentId,
            validated<PaymentEvidenceUploadInput>(res, "body"),
          ),
        ),
      );
  verify = async (req: Request, res: Response) => {
    const ids = validated<{ paymentId: string; attemptId: string }>(res, "params");
    return res
      .status(200)
      .json(
        successResponse(
          "Payment verification completed",
          req.id,
          await this.service.verifyAttempt(
            actor(req),
            ids.paymentId,
            ids.attemptId,
            context(req),
          ),
        ),
      );
  };
  manual = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Manual payment submitted for review",
          req.id,
          await this.service.submitManual(
            actor(req),
            validated<{ paymentId: string }>(res, "params").paymentId,
            validated<ManualPaymentInput>(res, "body"),
            key(res),
            context(req),
          ),
        ),
      );
  staffList = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Payments retrieved",
          req.id,
          await this.service.staffList(
            actor(req),
            validated<StaffPaymentListQuery>(res, "query"),
          ),
        ),
      );
  reviewManual = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Manual payment reviewed",
          req.id,
          await this.service.reviewManual(
            actor(req),
            validated<{ attemptId: string }>(res, "params").attemptId,
            validated<ManualReviewInput>(res, "body"),
            context(req),
          ),
        ),
      );
  manualEvidence = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Evidence access authorized",
          req.id,
          await this.service.manualEvidenceAccess(
            actor(req),
            validated<{ attemptId: string }>(res, "params").attemptId,
            context(req),
          ),
        ),
      );
  requestRefund = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Refund requested",
          req.id,
          await this.service.requestRefund(
            actor(req),
            validated<RefundCreateInput>(res, "body"),
            key(res),
            context(req),
          ),
        ),
      );
  decideRefund = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Refund decision recorded",
          req.id,
          await this.service.decideRefund(
            actor(req),
            validated<{ refundId: string }>(res, "params").refundId,
            validated<RefundDecisionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  webhook = async (req: Request, res: Response) => {
    assertPaystackMode();
    const raw = req.body as Buffer;
    const signature = validated<{ "x-paystack-signature": string }>(res, "headers")[
      "x-paystack-signature"
    ];
    if (
      env.PAYSTACK_SECRET_KEY === undefined ||
      !verifyPaystackSignature(raw, signature, env.PAYSTACK_SECRET_KEY)
    )
      throw webhookUnauthorized();
    const event = parsePaystackWebhook(raw);
    res
      .status(200)
      .json(
        successResponse(
          "Webhook accepted",
          req.id,
          await this.service.ingestWebhook(
            event,
            paystackPayloadSha256(raw),
            context(req),
          ),
        ),
      );
  };

  monnifyWebhook = async (req: Request, res: Response) => {
    assertMonnifyMode();
    if (env.MONNIFY_MODE === "disabled" || env.MONNIFY_SECRET_KEY === undefined)
      throw webhookUnauthorized();
    const raw = req.body as Buffer;
    const signature = validated<{ "monnify-signature"?: string }>(res, "headers")[
      "monnify-signature"
    ];
    const signatureVerified =
      env.MONNIFY_MODE === "live" &&
      signature !== undefined &&
      verifyMonnifySignature(raw, signature, env.MONNIFY_SECRET_KEY);
    if (env.MONNIFY_MODE === "live" && !signatureVerified) throw webhookUnauthorized();
    const event = parseMonnifyWebhook(raw);
    res
      .status(200)
      .json(
        successResponse(
          "Webhook accepted",
          req.id,
          await this.service.ingestMonnifyWebhook(
            event,
            monnifyPayloadSha256(raw),
            signatureVerified,
            context(req),
          ),
        ),
      );
  };
}
