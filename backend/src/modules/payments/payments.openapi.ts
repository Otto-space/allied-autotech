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
  refundRecoveryQuerySchema,
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
const verificationBehavior =
  "Successful provider facts are immutable. Each distinct provider receipt is recorded once; reuse of its transaction identity on another attempt is held for review without a second credit. Different receipts on an already-settled payment are retained without settling the payable twice. Positive NGN amount mismatches record the actual received amount under review. Repeated mismatch reports are idempotent; conflicting later observations are retained as anomalies. A wrong reference, unsupported currency, missing transaction identity or non-positive successful amount is held for reconciliation without inventing NGN capture facts. Such a hold blocks checkout replay and new attempts, and is not automatically cleared by later reports. Mismatched funds are not automatically allocated or refunded.";
type Route = {
  method: "get" | "post";
  path: string;
  summary: string;
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
  headers?: ZodType;
  created?: boolean;
  attemptCreation?: boolean;
  intentCreation?: boolean;
  verification?: boolean;
};
export function registerPaymentsOpenApi(registry: OpenAPIRegistry): void {
  const routes: Route[] = [
    {
      method: "get",
      path: "/customers/payments",
      summary: "List own payments, optionally for one vehicle purchase",
      query: paymentListQuerySchema,
    },
    {
      method: "post",
      path: "/customers/payments",
      summary: "Create a server-priced payment intent",
      intentCreation: true,
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
      attemptCreation: true,
      params: z.object({ paymentId: uuid }),
      headers: idempotent,
      created: true,
    },
    {
      method: "post",
      path: "/customers/payments/{paymentId}/monnify",
      summary: "Initialize Monnify hosted Pay-with-Bank checkout",
      attemptCreation: true,
      params: z.object({ paymentId: uuid }),
      headers: idempotent,
      created: true,
    },
    {
      method: "post",
      path: "/customers/payments/{paymentId}/attempts/{attemptId}/verify",
      summary: "Verify an online payment attempt with its stored provider",
      verification: true,
      params: z.object({ paymentId: uuid, attemptId: uuid }),
      headers: csrf,
    },
    {
      method: "post",
      path: "/customers/payments/{paymentId}/manual",
      summary: "Submit manual-payment evidence",
      attemptCreation: true,
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
      method: "get",
      path: "/staff/payments/{paymentId}",
      summary: "Read a current private payment for administrator review",
      params: z.object({ paymentId: uuid }),
      query: z.object({}).strict(),
    },
    {
      method: "get",
      path: "/staff/payments/refunds/original-request",
      summary: "Read the original actor-bound refund request without resubmitting",
      query: refundRecoveryQuerySchema,
      headers: idempotent.omit({ "x-csrf-token": true }),
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
      description:
        (route.path.startsWith("/staff/")
          ? "Requires ADMIN or SUPER_ADMIN with verified MFA. STAFF has no payment, evidence or refund access. Existing separation-of-duties and transactional checks also apply."
          : "Requires the customer account that owns the payment; server verification remains authoritative.") +
        (route.method === "get" && route.path === "/customers/payments"
          ? " Optional vehicleTransactionId filters within the authenticated customer's payments before pagination. A cursor for another customer, target or selected status is rejected. An empty result does not reveal whether a different customer owns the target."
          : "") +
        (route.method === "get" && route.path === "/customers/payments/{paymentId}"
          ? " The private no-store detail response includes checkoutProviders, containing only currently enabled online provider names. An empty array means online checkout is unavailable. This is configuration availability, not authorization to charge; initialization independently validates the current payable and competing attempts. No provider credentials or internal configuration are exposed."
          : "") +
        (route.path === "/staff/payments" || route.path === "/staff/payments/{paymentId}"
          ? " Staff-only private no-store reads are audited and include updatedAt plus manualReview.reviewerNote and actor-specific canReview. Submitter/reviewer identities, customer IDs and storage object keys are excluded. Customer projections are unchanged. Provider filtering matches any attempt and retains all attempts on each matching payment."
          : "") +
        (route.path === "/staff/payments/refunds/original-request"
          ? " This private no-store read uses the original Idempotency-Key header and paymentAttemptId query. A found record belongs to the current requester and returns the safe current refund projection; another requester receives404. No domain mutation or submission occurs. A missing record returns found:false,refund:null and does not prove an in-flight request failed. READ audits never retain the raw key or financial reason."
          : "") +
        (route.path === "/staff/payments/refunds"
          ? " Original-key replay requires the same requester and exact attempt, amount and reason. Creation/replay return safe queue fields without idempotency hashes, beneficiary encryption, object keys or reconciliation tokens. Concurrent same-key requests create one refund and one request audit."
          : "") +
        (route.attemptCreation
          ? " Only one unresolved attempt is permitted per payment across manual, Paystack and Monnify methods. A different key while an attempt is unresolved returns 409 PAYMENT_ATTEMPT_PENDING; original-key replay retains an unresolved checkout or the committed manual submission. A terminal checkout URL is never replayed. An initialization timeout or expired checkout URL does not prove failure. Verify or review the existing attempt before starting another. A shared payable lock also blocks competing attempts across legacy payment records with 409 PAYMENT_TARGET_PENDING. New charges recheck the source status, expiry and amount due."
          : "") +
        (route.intentCreation
          ? " Requests for the same order, service invoice or vehicle transaction are serialized across keys and vehicle purposes. An existing live request or unresolved attempt returns 409 PAYMENT_TARGET_PENDING; open the existing payment instead. Original-key replay returns its original record even after settlement. An expired unattempted record can be replaced; local expiry alone never releases an unresolved attempt. Settled vehicle payments reduce the amount due for a later balance request. Legacy surplus captures remain recorded in the ledger and flagged for review without reallocating an already-paid obligation."
          : "") +
        (route.verification ? ` ${verificationBehavior}` : ""),
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
          content: {
            "application/json": {
              schema:
                route.method === "get" && route.path === "/customers/payments/{paymentId}"
                  ? response.extend({
                      data: z
                        .object({
                          id: uuid,
                          status: z.string(),
                          checkoutProviders: z.array(z.enum(["PAYSTACK", "MONNIFY"])),
                        })
                        .passthrough(),
                    })
                  : response,
            },
          },
        },
      },
    });
  registry.registerPath({
    method: "post",
    path: "/webhooks/paystack",
    tags: ["Payments"],
    summary: "Receive a signature-verified Paystack webhook",
    description: `${verificationBehavior} A persisted duplicate is acknowledged without bypassing its retry schedule, active lease or dead-letter decision. Retry completion and related financial writes commit only while the same event attempt owns the record. Refund correlation is limited to Paystack payment attempts. Completed refunds remain immutable; conflicting refund observations are retained as anomalies. Later pending or failed observations cannot clear an existing refund review hold. Acknowledgement means accepted for processing, not necessarily settled.`,
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
    description: `${verificationBehavior} A persisted duplicate is acknowledged without bypassing its retry schedule, active lease or dead-letter decision. Retry completion and related financial writes commit only while the same event attempt owns the record. Provider-verification mismatches atomically persist the receipt and review hold. Completed refunds remain immutable; conflicting refund observations are retained as anomalies. Later pending or failed observations cannot clear an existing refund review hold. Acknowledgement means accepted for processing, not necessarily settled.`,
    request: {
      headers: z.object({ "monnify-signature": z.string().optional() }),
    },
    responses: {
      "200": { description: "Webhook accepted" },
      "401": { description: "Missing or invalid production signature" },
    },
  });
}
