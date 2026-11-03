import { Router, type Request, type Response } from "express";
import { AppError } from "../../common/errors/app-error.js";
import { successResponse } from "../../common/http/api-response.js";
import { requireTrustedOrigin } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import {
  clearPurchaseCookies,
  purchaseBrowserCookieName,
  purchaseCookieName,
  sessionCookieName,
  sessionCookieOptions,
} from "../../common/security/cookies.js";
import { PaymentsService } from "../payments/payments.service.js";
import { OrdersService } from "./orders.service.js";
import { PurchaseGuestAccessService } from "./purchase-guest-access.service.js";
import { PartsQuotesService } from "./parts-quotes.service.js";
import { FinancialDocumentsService } from "../billing/documents.service.js";
import { documentFilename, renderFinancialPdf } from "../billing/document-pdf.js";
import { invoiceParamsSchema } from "../billing/billing.schemas.js";
import { OrderAftercareService } from "./order-aftercare.service.js";
import {
  aftercareHeaders,
  aftercarePartialBody,
  customerAftercareView,
} from "./order-aftercare.schemas.js";
import { jsonSafe } from "./orders.types.js";
import {
  purchaseQuoteParamsSchema,
  purchaseQuoteAcceptSchema,
  purchaseQuoteDecisionSchema,
  purchaseQuoteListSchema,
  purchaseAftercareRecoverySchema,
} from "./purchase.schemas.js";
import {
  customerOrderListQuerySchema,
  customerOrderCancelBodySchema,
  guestCheckoutBodySchema,
  orderIdempotencyHeadersSchema,
  orderParamsSchema,
} from "./orders.schemas.js";
import {
  purchaseAttemptParamsSchema,
  purchaseCsrfHeadersSchema,
  purchaseEmptySchema,
  purchaseGatewaySchema,
  purchasePaymentParamsSchema,
  purchasePaymentSchema,
  purchaseRequestSchema,
  purchaseRevokeSchema,
  purchaseVerifySchema,
} from "./purchase.schemas.js";

const validated = <T>(res: Response, location: "body" | "params" | "query" | "headers") =>
  res.locals.validated?.[location] as T;
const session = (req: Request): string =>
  typeof req.cookies?.[purchaseCookieName] === "string"
    ? req.cookies[purchaseCookieName]
    : "";
const credentials = (req: Request) => ({
  sessionToken: session(req),
  csrfToken: req.get("x-csrf-token") ?? "",
});
const key = (res: Response) =>
  validated<{ "idempotency-key": string }>(res, "headers")["idempotency-key"];
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const send = (
  req: Request,
  res: Response,
  message: string,
  data?: unknown,
  status = 200,
) => res.status(status).json(successResponse(message, req.id, data));

/** This principal has no account role and never enters account/MFA middleware. */
export function createPurchaseRouter(
  access = new PurchaseGuestAccessService(),
  orders = new OrdersService(),
  payments = new PaymentsService(),
  quotes = new PartsQuotesService(),
  documents = new FinancialDocumentsService(),
  aftercare = new OrderAftercareService(),
): Router {
  const router = Router();
  router.use((req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    if (req.cookies?.[sessionCookieName]) {
      next(
        new AppError({
          code: "CONFLICT",
          statusCode: 409,
          message:
            "This browser is signed in. Continue through your account, or sign out before using purchase access.",
        }),
      );
      return;
    }
    next();
  });
  router.post(
    "/access/request",
    createSensitiveRateLimit(5, 60 * 60_000),
    requireTrustedOrigin,
    validate({ body: purchaseRequestSchema, query: purchaseEmptySchema }),
    async (req, res) => {
      const result = await access.request(
        validated<{ email: string }>(res, "body").email,
        req.cookies?.[purchaseBrowserCookieName],
        req.get("origin"),
      );
      res.cookie(
        purchaseBrowserCookieName,
        result.browserToken,
        sessionCookieOptions(result.expiresAt),
      );
      send(req, res, result.message, undefined, 202);
    },
  );
  router.post(
    "/access/verify",
    createSensitiveRateLimit(10),
    requireTrustedOrigin,
    validate({ body: purchaseVerifySchema, query: purchaseEmptySchema }),
    async (req, res) => {
      const result = await access.verify(
        validated<{ token: string }>(res, "body").token,
        req.cookies?.[purchaseBrowserCookieName] ?? "",
        session(req),
      );
      clearPurchaseCookies(res);
      res.cookie(
        purchaseCookieName,
        result.sessionToken,
        sessionCookieOptions(result.access.expiresAt),
      );
      send(req, res, "Purchase access verified", {
        email: result.access.email,
        buyerReference: result.access.guestId,
        expiresAt: result.access.expiresAt,
        csrfToken: result.csrfToken,
      });
    },
  );
  router.get("/access", validate({ query: purchaseEmptySchema }), async (req, res) => {
    const current = await access.access(session(req), { kind: "read" });
    send(req, res, "Purchase access retrieved", {
      email: current.email,
      buyerReference: current.guestId,
      expiresAt: current.expiresAt,
    });
  });
  router.post(
    "/access/csrf",
    createSensitiveRateLimit(30),
    requireTrustedOrigin,
    validate({ body: purchaseEmptySchema, query: purchaseEmptySchema }),
    async (req, res) => {
      send(req, res, "Purchase request token refreshed", {
        csrfToken: await access.rotateCsrf(session(req)),
      });
    },
  );
  router.delete(
    "/access",
    requireTrustedOrigin,
    validate({
      headers: purchaseCsrfHeadersSchema,
      body: purchaseRevokeSchema,
      query: purchaseEmptySchema,
    }),
    async (req, res) => {
      await access.revoke(
        session(req),
        credentials(req).csrfToken,
        validated<{ allSessions: boolean }>(res, "body").allSessions,
      );
      clearPurchaseCookies(res);
      send(req, res, "Purchase access ended");
    },
  );
  router.get(
    "/orders/original-request",
    validate({ headers: orderIdempotencyHeadersSchema, query: purchaseEmptySchema }),
    async (req, res) => {
      send(
        req,
        res,
        "Original purchase request checked",
        await orders.guestOriginalCheckout(session(req), key(res)),
      );
    },
  );
  router.get(
    "/orders",
    validate({ query: customerOrderListQuerySchema }),
    async (req, res) => {
      send(
        req,
        res,
        "Purchase orders retrieved",
        await orders.guestOrders(session(req), validated(res, "query")),
      );
    },
  );
  router.get(
    "/orders/:orderId",
    validate({ params: orderParamsSchema, query: purchaseEmptySchema }),
    async (req, res) => {
      send(
        req,
        res,
        "Purchase order retrieved",
        await orders.guestOrder(
          session(req),
          validated<{ orderId: string }>(res, "params").orderId,
        ),
      );
    },
  );
  router.post(
    "/orders",
    requireTrustedOrigin,
    validate({
      headers: orderIdempotencyHeadersSchema.extend(purchaseCsrfHeadersSchema.shape),
      body: guestCheckoutBodySchema,
      query: purchaseEmptySchema,
    }),
    async (req, res) => {
      send(
        req,
        res,
        "Order saved; payment and final review remain separate",
        await orders.guestCheckout(
          credentials(req),
          validated(res, "body"),
          key(res),
          context(req),
        ),
        201,
      );
    },
  );
  router.post(
    "/payments",
    requireTrustedOrigin,
    validate({
      headers: orderIdempotencyHeadersSchema.extend(purchaseCsrfHeadersSchema.shape),
      body: purchasePaymentSchema,
      query: purchaseEmptySchema,
    }),
    async (req, res) => {
      send(
        req,
        res,
        "Payment prepared",
        await payments.guestCreateIntent(
          credentials(req),
          validated<{ orderId: string }>(res, "body").orderId,
          key(res),
          context(req),
        ),
        201,
      );
    },
  );
  router.get(
    "/payments/:paymentId",
    validate({ params: purchasePaymentParamsSchema, query: purchaseEmptySchema }),
    async (req, res) => {
      send(
        req,
        res,
        "Payment retrieved",
        await payments.guestGet(
          session(req),
          validated<{ paymentId: string }>(res, "params").paymentId,
        ),
      );
    },
  );
  router.post(
    "/payments/:paymentId/checkout",
    createSensitiveRateLimit(20),
    requireTrustedOrigin,
    validate({
      headers: orderIdempotencyHeadersSchema.extend(purchaseCsrfHeadersSchema.shape),
      params: purchasePaymentParamsSchema,
      body: purchaseGatewaySchema,
      query: purchaseEmptySchema,
    }),
    async (req, res) => {
      send(
        req,
        res,
        "Payment checkout prepared",
        await payments.guestInitialize(
          credentials(req),
          validated<{ paymentId: string }>(res, "params").paymentId,
          key(res),
          context(req),
          validated<{ provider: "PAYSTACK" | "MONNIFY" }>(res, "body").provider,
          req.get("origin"),
        ),
      );
    },
  );
  router.post(
    "/payments/:paymentId/attempts/:attemptId/verify",
    createSensitiveRateLimit(30),
    requireTrustedOrigin,
    validate({
      headers: purchaseCsrfHeadersSchema,
      params: purchaseAttemptParamsSchema,
      body: purchaseEmptySchema,
      query: purchaseEmptySchema,
    }),
    async (req, res) => {
      const ids = validated<{ paymentId: string; attemptId: string }>(res, "params");
      send(
        req,
        res,
        "Payment status checked",
        await payments.guestVerifyAttempt(
          credentials(req),
          ids.paymentId,
          ids.attemptId,
          context(req),
        ),
      );
    },
  );
  router.get(
    "/parts-quotes",
    validate({ query: purchaseQuoteListSchema }),
    async (req, res) => {
      send(
        req,
        res,
        "Your guest quotations",
        await quotes.guestList(session(req), validated(res, "query")),
      );
    },
  );
  router.post(
    "/parts-quotes/:quoteId/decline",
    createSensitiveRateLimit(30, 60 * 60_000),
    requireTrustedOrigin,
    validate({
      headers: purchaseCsrfHeadersSchema,
      params: purchaseQuoteParamsSchema,
      body: purchaseQuoteDecisionSchema,
      query: purchaseEmptySchema,
    }),
    async (req, res) => {
      send(
        req,
        res,
        "Quotation declined",
        await quotes.guestDecline(
          credentials(req),
          validated<{ quoteId: string }>(res, "params").quoteId,
          validated<{ revision: number }>(res, "body").revision,
          context(req),
        ),
      );
    },
  );
  router.post(
    "/parts-quotes/:quoteId/accept",
    createSensitiveRateLimit(20, 60 * 60_000),
    requireTrustedOrigin,
    validate({
      headers: orderIdempotencyHeadersSchema.extend(purchaseCsrfHeadersSchema.shape),
      params: purchaseQuoteParamsSchema,
      body: purchaseQuoteAcceptSchema,
      query: purchaseEmptySchema,
    }),
    async (req, res) => {
      send(
        req,
        res,
        "Quotation accepted; order is unpaid",
        await orders.guestAcceptQuote(
          credentials(req),
          validated<{ quoteId: string }>(res, "params").quoteId,
          validated(res, "body"),
          key(res),
          context(req),
        ),
        201,
      );
    },
  );
  router.get(
    "/orders/:orderId/aftercare/original-request",
    validate({
      params: orderParamsSchema,
      query: purchaseAftercareRecoverySchema,
      headers: aftercareHeaders,
    }),
    async (req, res) => {
      send(
        req,
        res,
        "Original order action checked",
        jsonSafe(
          await aftercare.guestOriginal(
            session(req),
            validated<{ orderId: string }>(res, "params").orderId,
            validated<{ operation: "cancel" | "aftercare" }>(res, "query").operation,
            key(res),
          ),
        ),
      );
    },
  );
  router.get(
    "/orders/:orderId/aftercare",
    validate({ params: orderParamsSchema, query: purchaseEmptySchema }),
    async (req, res) => {
      send(
        req,
        res,
        "Your order requests",
        jsonSafe(
          await aftercare.guestList(
            session(req),
            validated<{ orderId: string }>(res, "params").orderId,
          ),
        ),
      );
    },
  );
  router.post(
    "/orders/:orderId/aftercare",
    createSensitiveRateLimit(20, 60 * 60_000),
    requireTrustedOrigin,
    validate({
      params: orderParamsSchema,
      query: purchaseEmptySchema,
      headers: aftercareHeaders.extend(purchaseCsrfHeadersSchema.shape),
      body: aftercarePartialBody,
    }),
    async (req, res) => {
      const record = await aftercare.guestRequest(
        credentials(req),
        validated<{ orderId: string }>(res, "params").orderId,
        validated(res, "body"),
        context(req),
        key(res),
      );
      send(
        req,
        res,
        "Order request received for staff review",
        jsonSafe({ ...customerAftercareView(record), replayed: record.replayed }),
        201,
      );
    },
  );
  router.post(
    "/orders/:orderId/cancel",
    createSensitiveRateLimit(20, 60 * 60_000),
    requireTrustedOrigin,
    validate({
      params: orderParamsSchema,
      query: purchaseEmptySchema,
      headers: aftercareHeaders.extend(purchaseCsrfHeadersSchema.shape),
      body: customerOrderCancelBodySchema,
    }),
    async (req, res) => {
      send(
        req,
        res,
        "Order cancellation recorded; no refund is confirmed",
        await orders.guestCancel(
          credentials(req),
          validated<{ orderId: string }>(res, "params").orderId,
          validated(res, "body"),
          key(res),
          context(req),
        ),
      );
    },
  );
  for (const format of ["document", "download"] as const) {
    router.get(
      `/invoices/:invoiceId/${format}`,
      createSensitiveRateLimit(20),
      validate({ params: invoiceParamsSchema, query: purchaseEmptySchema }),
      async (req, res) => {
        const document = await documents.guestInvoice(
          session(req),
          validated<{ invoiceId: string }>(res, "params").invoiceId,
        );
        res.set("X-Content-Type-Options", "nosniff");
        if (format === "document")
          return send(req, res, "Invoice document retrieved", document);
        return res
          .set("X-Document-Id", document.id)
          .set("X-Document-Type", "invoice")
          .type("application/pdf")
          .attachment(documentFilename("invoice", document.invoiceNumber))
          .send(await renderFinancialPdf(document));
      },
    );
    router.get(
      `/payments/:paymentId/receipt/${format}`,
      createSensitiveRateLimit(20),
      validate({ params: purchasePaymentParamsSchema, query: purchaseEmptySchema }),
      async (req, res) => {
        const document = await documents.guestReceipt(
          session(req),
          validated<{ paymentId: string }>(res, "params").paymentId,
        );
        res.set("X-Content-Type-Options", "nosniff");
        if (format === "document")
          return send(req, res, "Payment receipt retrieved", document);
        return res
          .set("X-Document-Id", document.paymentId)
          .set("X-Document-Type", "receipt")
          .type("application/pdf")
          .attachment(documentFilename("receipt", document.paymentNumber))
          .send(await renderFinancialPdf(document));
      },
    );
  }
  return router;
}
