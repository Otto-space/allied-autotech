import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  manualPaymentBodySchema,
  manualReviewBodySchema,
  paymentCreateBodySchema,
  paymentEvidenceUploadBodySchema,
  paymentListQuerySchema,
  refundCreateBodySchema,
  refundDecisionBodySchema,
  staffPaymentListQuerySchema,
} from "./payments.schemas.js";

const response = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrf = z.object({ "x-csrf-token": z.string().min(32) });
const idempotent = csrf.extend({ "idempotency-key": z.string().min(8).max(120) });
const uuid = z.uuid();
type Route = {
  method: "get" | "post";
  path: string;
  summary: string;
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
  headers?: ZodType;
  created?: boolean;
};
export function registerPaymentsOpenApi(registry: OpenAPIRegistry): void {
  const routes: Route[] = [
    {
      method: "get",
      path: "/customers/payments",
      summary: "List own payments",
      query: paymentListQuerySchema,
    },
    {
      method: "post",
      path: "/customers/payments",
      summary: "Create a server-priced payment intent",
      body: paymentCreateBodySchema,
      headers: idempotent,
      created: true,
    },
    {
      method: "get",
      path: "/customers/payments/{paymentId}",
      summary: "Get an owned payment",
      params: z.object({ paymentId: uuid }),
    },
    {
      method: "post",
      path: "/customers/payments/{paymentId}/paystack",
      summary: "Initialize Paystack checkout",
      params: z.object({ paymentId: uuid }),
      headers: idempotent,
      created: true,
    },
    {
      method: "post",
      path: "/customers/payments/{paymentId}/monnify",
      summary: "Initialize Monnify hosted Pay-with-Bank checkout",
      params: z.object({ paymentId: uuid }),
      headers: idempotent,
      created: true,
    },
    {
      method: "post",
      path: "/customers/payments/{paymentId}/attempts/{attemptId}/verify",
      summary: "Verify an online payment attempt with its stored provider",
      params: z.object({ paymentId: uuid, attemptId: uuid }),
      headers: csrf,
    },
    {
      method: "post",
      path: "/customers/payments/{paymentId}/manual",
      summary: "Submit manual-payment evidence",
      params: z.object({ paymentId: uuid }),
      body: manualPaymentBodySchema,
      headers: idempotent,
      created: true,
    },
    {
      method: "post",
      path: "/customers/payments/{paymentId}/manual-evidence/upload",
      summary: "Authorize a private manual-payment evidence upload",
      params: z.object({ paymentId: uuid }),
      body: paymentEvidenceUploadBodySchema,
      headers: csrf,
      created: true,
    },
    {
      method: "get",
      path: "/staff/payments",
      summary: "List payments for review",
      query: staffPaymentListQuerySchema,
    },
    {
      method: "post",
      path: "/staff/payments/manual-attempts/{attemptId}/review",
      summary: "Review a manual payment with separation of duties",
      params: z.object({ attemptId: uuid }),
      body: manualReviewBodySchema,
      headers: csrf,
    },
    {
      method: "post",
      path: "/staff/payments/manual-attempts/{attemptId}/evidence-access",
      summary: "Authorize short-lived private evidence access",
      params: z.object({ attemptId: uuid }),
      headers: csrf,
    },
    {
      method: "post",
      path: "/staff/payments/refunds",
      summary: "Request a refund",
      body: refundCreateBodySchema,
      headers: idempotent,
      created: true,
    },
    {
      method: "post",
      path: "/staff/payments/refunds/{refundId}/decision",
      summary: "Approve or cancel a refund with separation of duties",
      params: z.object({ refundId: uuid }),
      body: refundDecisionBodySchema,
      headers: csrf,
    },
  ];
  for (const route of routes)
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Payments"],
      summary: route.summary,
      security: [{ sessionCookie: [] }],
      request: {
        ...(route.params ? { params: route.params as never } : {}),
        ...(route.query ? { query: route.query as never } : {}),
        ...(route.headers ? { headers: route.headers as never } : {}),
        ...(route.body
          ? {
              body: {
                required: true,
                content: { "application/json": { schema: route.body } },
              },
            }
          : {}),
      },
      responses: {
        [route.created ? "201" : "200"]: {
          description: "Request completed",
          content: { "application/json": { schema: response } },
        },
      },
    });
  registry.registerPath({
    method: "post",
    path: "/webhooks/paystack",
    tags: ["Payments"],
    summary: "Receive a signature-verified Paystack webhook",
    request: { headers: z.object({ "x-paystack-signature": z.string() }) },
    responses: {
      "200": { description: "Webhook accepted" },
      "401": { description: "Invalid signature" },
    },
  });
  registry.registerPath({
    method: "post",
    path: "/webhooks/monnify",
    tags: ["Payments"],
    summary: "Receive a verified Monnify webhook",
    request: {
      headers: z.object({ "monnify-signature": z.string().optional() }),
    },
    responses: {
      "200": { description: "Webhook accepted" },
      "401": { description: "Missing or invalid production signature" },
    },
  });
}
