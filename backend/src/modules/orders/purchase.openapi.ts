import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import { purchaseReviewRequestSchema } from "./purchase-review.schemas.js";
import { invoiceParamsSchema } from "../billing/billing.schemas.js";
import { aftercareHeaders, aftercarePartialBody } from "./order-aftercare.schemas.js";
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
import {
  purchaseQuoteAcceptSchema,
  purchaseQuoteDecisionSchema,
  purchaseQuoteListSchema,
  purchaseQuoteParamsSchema,
  purchaseAftercareRecoverySchema,
} from "./purchase.schemas.js";

const response = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
type Fields = NonNullable<
  NonNullable<Parameters<OpenAPIRegistry["registerPath"]>[0]["request"]>["params"]
>;
type Path = {
  method: "get" | "post" | "delete";
  path: string;
  summary: string;
  body?: ZodType;
  headers?: Fields;
  params?: Fields;
  query?: Fields;
  status?: number;
  public?: boolean;
  pdf?: boolean;
};

export function registerPurchaseOpenApi(registry: OpenAPIRegistry): void {
  registry.registerComponent("securitySchemes", "purchaseGuestCookie", {
    type: "apiKey",
    in: "cookie",
    name: "__Host-aat_purchase",
    description:
      "Separate verified purchase access. Grants no customer-account, workforce or MFA permissions.",
  });
  const keyed = orderIdempotencyHeadersSchema.extend(purchaseCsrfHeadersSchema.shape);
  const paths: Path[] = [
    {
      method: "post",
      path: "/orders/{orderId}/purchase-review",
      summary:
        "Submit specifications for an owned guest order without creating an account",
      params: orderParamsSchema,
      body: purchaseReviewRequestSchema,
      headers: purchaseCsrfHeadersSchema,
    },
    {
      method: "get",
      path: "/orders/{orderId}/aftercare/original-request",
      summary:
        "Recover an owned guest cancellation or aftercare action without resubmitting private request details",
      params: orderParamsSchema,
      query: purchaseAftercareRecoverySchema,
      headers: aftercareHeaders,
    },
    {
      method: "get",
      path: "/orders/{orderId}/aftercare",
      summary: "Read only the verified guest's customer-visible order requests",
      params: orderParamsSchema,
    },
    {
      method: "post",
      path: "/orders/{orderId}/aftercare",
      summary:
        "Request scoped guest return or cancellation review without changing money or stock",
      params: orderParamsSchema,
      body: aftercarePartialBody,
      headers: aftercareHeaders.extend(purchaseCsrfHeadersSchema.shape),
      status: 201,
    },
    {
      method: "post",
      path: "/orders/{orderId}/cancel",
      summary:
        "Cancel an owned pending guest order with a version check; paid cancellations require separate human refund review",
      params: orderParamsSchema,
      body: customerOrderCancelBodySchema,
      headers: aftercareHeaders.extend(purchaseCsrfHeadersSchema.shape),
    },
    ...(["document", "download"] as const).flatMap((format): Path[] => [
      {
        method: "get",
        path: `/invoices/{invoiceId}/${format}`,
        summary: `Read an owned issued guest invoice as ${format === "download" ? "a private PDF" : "a document"}`,
        params: invoiceParamsSchema,
        pdf: format === "download",
      },
      {
        method: "get",
        path: `/payments/{paymentId}/receipt/${format}`,
        summary: `Read an owned verified settled guest payment receipt as ${format === "download" ? "a private PDF" : "a document"}`,
        params: purchasePaymentParamsSchema,
        pdf: format === "download",
      },
    ]),
    {
      method: "get",
      path: "/parts-quotes",
      summary:
        "List only explicit guest-directed quotations for the verified purchase recipient",
      query: purchaseQuoteListSchema,
    },
    {
      method: "post",
      path: "/parts-quotes/{quoteId}/decline",
      summary: "Decline an owned current guest quotation",
      params: purchaseQuoteParamsSchema,
      body: purchaseQuoteDecisionSchema,
      headers: purchaseCsrfHeadersSchema,
    },
    {
      method: "post",
      path: "/parts-quotes/{quoteId}/accept",
      summary:
        "Accept a guest quotation through the shared exact-price collection checkout without creating an account",
      params: purchaseQuoteParamsSchema,
      body: purchaseQuoteAcceptSchema,
      headers: keyed,
      status: 201,
    },
    {
      method: "post",
      path: "/access/request",
      summary:
        "Request a browser-bound private purchase-access link without creating an account",
      body: purchaseRequestSchema,
      public: true,
      status: 202,
    },
    {
      method: "post",
      path: "/access/verify",
      summary: "Consume a single-use purchase proof in its requesting browser",
      body: purchaseVerifySchema,
      public: true,
    },
    {
      method: "get",
      path: "/access",
      summary: "Read the current verified purchase access",
    },
    {
      method: "post",
      path: "/access/csrf",
      summary:
        "Rotate the purchase CSRF token using a current guest cookie and trusted origin",
      body: purchaseEmptySchema,
    },
    {
      method: "delete",
      path: "/access",
      summary:
        "End this purchase access or revoke all purchase sessions for its verified buyer",
      body: purchaseRevokeSchema,
      headers: purchaseCsrfHeadersSchema,
    },
    {
      method: "get",
      path: "/orders/original-request",
      summary:
        "Recover an owned checkout receipt using its original retry key; absence is not proof of failure",
      headers: orderIdempotencyHeadersSchema,
    },
    {
      method: "get",
      path: "/orders",
      summary: "List only this verified guest's orders",
      query: customerOrderListQuerySchema,
    },
    {
      method: "get",
      path: "/orders/{orderId}",
      summary: "Read an owned guest order",
      params: orderParamsSchema,
    },
    {
      method: "post",
      path: "/orders",
      summary:
        "Save a server-priced guest collection order without creating an account or charging it",
      body: guestCheckoutBodySchema,
      headers: keyed,
      status: 201,
    },
    {
      method: "post",
      path: "/payments",
      summary: "Prepare an exact payment for an owned guest order",
      body: purchasePaymentSchema,
      headers: keyed,
      status: 201,
    },
    {
      method: "get",
      path: "/payments/{paymentId}",
      summary:
        "Read an owned guest payment without treating a callback as proof of payment",
      params: purchasePaymentParamsSchema,
    },
    {
      method: "post",
      path: "/payments/{paymentId}/checkout",
      summary: "Initialize or recover a guarded guest gateway checkout",
      body: purchaseGatewaySchema,
      headers: keyed,
      params: purchasePaymentParamsSchema,
    },
    {
      method: "post",
      path: "/payments/{paymentId}/attempts/{attemptId}/verify",
      summary:
        "Verify an owned guest attempt through its configured provider and reconcile capture once",
      body: purchaseEmptySchema,
      headers: purchaseCsrfHeadersSchema,
      params: purchaseAttemptParamsSchema,
    },
  ];
  for (const entry of paths)
    registry.registerPath({
      method: entry.method,
      path: `/purchase${entry.path}`,
      tags: ["Purchase access"],
      summary: entry.summary,
      description:
        "No account session cookie may coexist with purchase access, including an MFA-pending account session. Catalogue mode closes purchase access. Limited releases retain security/recovery, owned reads, cancellation and aftercare review; new checkout/payment mutations remain closed. Tokens stay in HttpOnly cookies or memory; no URL query or browser-storage credentials. Trusted Origin is mandatory for every mutation. Payment, allocation and collection readiness remain distinct. Guests cannot approve returns or refunds or initiate money movement.",
      security: entry.public ? [] : [{ purchaseGuestCookie: [] }],
      request: {
        query: entry.query ?? purchaseEmptySchema.removeDefault(),
        ...(entry.params ? { params: entry.params } : {}),
        ...(entry.headers ? { headers: entry.headers } : {}),
        ...(entry.body
          ? {
              body: {
                required: true,
                content: { "application/json": { schema: entry.body } },
              },
            }
          : {}),
      },
      responses: {
        [entry.status ?? 200]: {
          description: "Success",
          content: entry.pdf
            ? { "application/pdf": { schema: { type: "string", format: "binary" } } }
            : { "application/json": { schema: response } },
        },
      },
      "x-trusted-origin-required": entry.method !== "get",
    });
}
