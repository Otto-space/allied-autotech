import {
  aftercareReturnBody,
  aftercarePartialBody,
  aftercareReviewBody,
  fulfillmentEvidenceBody,
  customerAftercareResponse,
  staffAftercareResponse,
} from "../orders/order-aftercare.schemas.js";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  bookingActionQuery,
  bookingActionBody,
} from "../service-operations/booking-actions.routes.js";
import { z } from "zod";
import {
  capabilityListQuerySchema,
  publishPolicyBodySchema,
  publicFulfillmentOptionsSchema,
  publicCapabilitiesSchema,
} from "./policies.schemas.js";
import {
  intake,
  review,
  hold,
  privacyPageQuery,
  holdQuery,
  releaseHold,
} from "./privacy.routes.js";
import { transfer, check } from "../payments/manual-refunds.routes.js";
import {
  refundQueueRecordSchema,
  refundActionResponseSchema,
  refundEvidenceResponseSchema,
} from "../payments/refund-record.js";
import { refundListQuerySchema } from "../audit/audit.schemas.js";
import {
  refundDecisionBodySchema,
  paymentEvidenceUploadBodySchema,
} from "../payments/payments.schemas.js";
import {
  disputeAssignmentSchema,
  disputeEvidenceSchema,
  disputeSubmissionSchema,
  disputeAcknowledgementSchema,
  disputeListSchema,
  disputeRecordSchema,
  privateEvidenceUploadSchema,
} from "../payments/disputes.schemas.js";

const id = z.object({ id: z.uuid() });
const refundId = z.object({ refundId: z.uuid() });
const privacyRecord = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  kind: z.enum(["ANONYMIZATION", "DELETION"]),
  reason: z.string(),
  status: z.enum([
    "REQUESTED",
    "UNDER_REVIEW",
    "ON_HOLD",
    "APPROVED_PENDING_POLICY",
    "REJECTED",
  ]),
  createdAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().nullable(),
  reviewNote: z.string().nullable(),
});
const staffPrivacyRecord = privacyRecord.extend({
  reviewedByUserId: z.uuid().nullable(),
});
const retentionHoldRecord = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  recordType: z.enum(["ALL", "ACCOUNT", "PAYMENT", "INVOICE", "AUDIT", "SUPPORT"]),
  recordId: z.uuid().nullable(),
  reason: z.string(),
  createdByUserId: z.uuid(),
  createdAt: z.iso.datetime(),
  releasedAt: z.iso.datetime().nullable(),
  releasedByUserId: z.uuid().nullable(),
});
const capabilities = z.enum([
  "REFUND_APPROVE",
  "REFUND_TRANSFER",
  "REFUND_CHECK",
  "FINANCE_POLICY_APPROVE",
  "BOOKING_CONFIRM",
  "PRIVACY_REVIEW",
  "DISPUTE_MANAGE",
]);
const envelope = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown(),
  meta: z.object({ requestId: z.string(), serverTime: z.iso.datetime() }),
});
type Route = {
  method: "get" | "post";
  path: string;
  summary: string;
  body?: z.ZodType;
  query?: z.ZodObject;
  params?: z.ZodObject;
  created?: boolean;
  capability?: string;
  roles?: string[];
  data?: z.ZodType;
  description?: string;
};

export function registerOwnerPolicyOpenApi(registry: OpenAPIRegistry) {
  const routes: Route[] = [
    {
      method: "get",
      path: "/public/fulfillment-options",
      summary:
        "Read collection details and currently effective approved delivery zones without private policy provenance",
      data: publicFulfillmentOptionsSchema,
    },
    {
      method: "get",
      path: "/public/capabilities",
      summary: "Read effective policy availability and server time",
      description:
        "Informational only, not transaction authorization or a price quote. Checkout uses fulfillment-options for approved zones. Missing finance is represented by null approvalStatus and disabled checkout; private local/staging draft finance follows the existing finance gate. No private policy provenance is exposed. Refresh on use; responses are no-store.",
      data: publicCapabilitiesSchema,
    },
    {
      method: "get",
      path: "/staff/finance-policy",
      summary: "Read the latest 100 financial policy versions for approval review",
      roles: ["STAFF", "ADMIN", "SUPER_ADMIN"],
      capability: "FINANCE_POLICY_APPROVE; SUPER_ADMIN may read without a grant",
    },
    {
      method: "get",
      path: "/admin/policies",
      summary: "Read immutable policy history",
      query: z.object({
        key: z.string(),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      }),
      roles: ["SUPER_ADMIN"],
    },
    {
      method: "post",
      path: "/admin/policies",
      summary: "Publish an approved policy version with written provenance",
      body: publishPolicyBodySchema,
      created: true,
      roles: ["STAFF", "ADMIN", "SUPER_ADMIN"],
      capability:
        "FINANCE_POLICY_APPROVE for FINANCE; SUPER_ADMIN for other policy kinds",
    },
    {
      method: "get",
      path: "/admin/capabilities",
      summary:
        "Read the latest 100 grants and revocations, or all active grants with activeOnly=true",
      query: capabilityListQuerySchema,
      roles: ["SUPER_ADMIN"],
    },
    {
      method: "post",
      path: "/admin/capabilities",
      summary: "Grant a narrow duty to a verified existing account",
      body: z.object({ userId: z.uuid(), capability: capabilities }).strict(),
      created: true,
      roles: ["SUPER_ADMIN"],
    },
    {
      method: "post",
      path: "/admin/capabilities/{id}/revoke",
      summary: "Revoke a duty immediately with an audit reason",
      params: id,
      body: z.object({ reason: z.string().min(10).max(1000) }).strict(),
      roles: ["SUPER_ADMIN"],
    },
    {
      method: "get",
      path: "/customers/privacy-requests",
      summary: "List own privacy requests",
      query: privacyPageQuery,
      data: z.object({ items: z.array(privacyRecord), nextCursor: z.uuid().nullable() }),
    },
    {
      method: "post",
      path: "/customers/privacy-requests",
      summary:
        "Request reviewed anonymization or deletion without scheduling destruction",
      body: intake,
      created: true,
      data: privacyRecord,
    },
    {
      method: "get",
      path: "/staff/privacy-requests",
      summary: "List privacy review queue",
      query: privacyPageQuery,
      data: z.object({
        items: z.array(staffPrivacyRecord),
        nextCursor: z.uuid().nullable(),
      }),
      capability: "PRIVACY_REVIEW",
    },
    {
      method: "post",
      path: "/staff/privacy-requests/{id}/review",
      summary:
        "Review a privacy request subject to retention and dispute holds; optional expectedReviewedAt rejects stale decisions",
      body: review,
      params: id,
      data: staffPrivacyRecord,
      capability: "PRIVACY_REVIEW",
    },
    {
      method: "get",
      path: "/staff/retention-holds",
      summary: "Read retention holds for one account",
      query: holdQuery,
      data: z.array(retentionHoldRecord),
      capability: "PRIVACY_REVIEW",
    },
    {
      method: "post",
      path: "/staff/retention-holds",
      summary: "Record a legal or accounting retention hold",
      body: hold,
      created: true,
      data: retentionHoldRecord,
      capability: "PRIVACY_REVIEW",
    },
    {
      method: "post",
      path: "/staff/retention-holds/{id}/release",
      summary: "Release a hold with written justification; destruction stays disabled",
      body: releaseHold,
      params: id,
      data: z.object({ id: z.uuid() }),
      capability: "PRIVACY_REVIEW",
    },
    {
      method: "get",
      path: "/customers/orders/{id}/aftercare",
      summary:
        "Read latest 100 own cancellation and return requests without internal approval data",
      params: id,
      data: z.array(customerAftercareResponse),
    },
    {
      method: "get",
      path: "/staff/orders/{id}/aftercare",
      summary: "Read latest 100 branch-authorized order review requests",
      params: id,
      data: z.array(staffAftercareResponse),
    },
    {
      method: "post",
      path: "/customers/orders/{id}/returns",
      summary: "Request a whole-order return for timing and condition review",
      params: id,
      body: aftercareReturnBody,
      created: true,
      data: customerAftercareResponse,
    },
    {
      method: "post",
      path: "/customers/orders/{id}/aftercare",
      summary:
        "Request selected-line cancellation or return; existing active requests retain their original details",
      params: id,
      body: aftercarePartialBody,
      created: true,
      data: customerAftercareResponse,
    },
    {
      method: "post",
      path: "/staff/orders/{id}/fulfillment-evidence",
      summary: "Record delivery or collection evidence once",
      params: id,
      body: fulfillmentEvidenceBody,
      data: z.object({
        id: z.uuid(),
        fulfillmentEvidenceAt: z.iso.datetime(),
        fulfillmentEvidenceReference: z.string(),
      }),
    },
    {
      method: "post",
      path: "/staff/order-requests/{id}/review",
      summary:
        "Record receipt, inspection or fee decision; optional expectedStatus prevents stale stage review",
      params: id,
      body: aftercareReviewBody,
      data: staffAftercareResponse,
      capability:
        "FINANCE_POLICY_APPROVE for APPROVED/REJECTED; branch-authorized staff for receipt/inspection",
    },
    {
      method: "post",
      path: "/staff/support/complaints/{supportId}/acknowledge",
      summary:
        "Acknowledge a complaint with a customer-visible message without resolving it",
      params: z.object({ supportId: z.uuid() }),
      body: z.object({ message: z.string().min(10).max(2000) }).strict(),
    },
    {
      method: "post",
      path: "/staff/refunds/{refundId}/decision",
      summary: "Independently approve or reject a refund; approval is not payment",
      params: refundId,
      body: refundDecisionBodySchema,
      capability: "REFUND_APPROVE",
      data: refundQueueRecordSchema,
    },
    {
      method: "get",
      path: "/staff/refunds",
      summary:
        "Read refunds relevant to an active refund approval, transfer or checking grant; no private evidence or beneficiary details",
      query: refundListQuerySchema,
      capability:
        "Any of REFUND_APPROVE, REFUND_TRANSFER, REFUND_CHECK; company-scoped grants, queue limited to the granted stage",
      data: z.object({
        items: z.array(refundQueueRecordSchema),
        nextCursor: z.uuid().optional(),
      }),
    },
    {
      method: "post",
      path: "/staff/refunds/{refundId}/evidence-upload",
      summary: "Issue a private bank-transfer evidence upload",
      params: refundId,
      body: paymentEvidenceUploadBodySchema,
      capability: "REFUND_TRANSFER",
      data: z.object({
        evidenceToken: z.string().min(80).max(4096),
        upload: z.object({
          method: z.literal("PUT"),
          url: z.url(),
          expiresAt: z.iso.datetime({ offset: true }),
          headers: z.record(z.string(), z.string()),
        }),
      }),
    },
    {
      method: "post",
      path: "/staff/refunds/{refundId}/transfer",
      summary: "Record an independent bank transfer and verified private evidence",
      params: refundId,
      body: transfer,
      capability: "REFUND_TRANSFER",
      data: refundActionResponseSchema,
    },
    {
      method: "post",
      path: "/staff/refunds/{refundId}/evidence-access",
      summary: "Issue short-lived private evidence access with audit",
      params: refundId,
      body: z.object({}).strict(),
      capability: "REFUND_CHECK",
      data: refundEvidenceResponseSchema,
    },
    {
      method: "post",
      path: "/staff/refunds/{refundId}/check",
      summary: "Independently check or dispute bank evidence before completion",
      params: refundId,
      body: check,
      capability: "REFUND_CHECK",
      data: refundActionResponseSchema,
    },
    {
      method: "get",
      path: "/staff/disputes",
      summary: "List assigned disputes and authoritative provider deadlines",
      query: disputeListSchema,
      data: z.object({
        items: z.array(disputeRecordSchema),
        nextCursor: z.uuid().nullable(),
      }),
      capability: "DISPUTE_MANAGE",
    },
  ];
  for (const [action, body, summary] of [
    [
      "assign",
      disputeAssignmentSchema,
      "Assign two verified primary and backup accounts",
    ],
    [
      "acknowledge",
      disputeAcknowledgementSchema,
      "Record dispute acknowledgement separately from resolution",
    ],
    [
      "evidence-upload",
      paymentEvidenceUploadBodySchema,
      "Issue a private dispute evidence upload",
    ],
    [
      "evidence",
      disputeEvidenceSchema,
      "Verify and preserve the dispute evidence bundle",
    ],
    [
      "evidence-access",
      z.object({}).strict(),
      "Issue audited short-lived dispute evidence access",
    ],
    [
      "submission",
      disputeSubmissionSchema,
      "Record a provider dashboard submission receipt without claiming acceptance",
    ],
  ] as const)
    routes.push({
      method: "post",
      path: `/staff/disputes/{id}/${action}`,
      data:
        action === "evidence-upload"
          ? privateEvidenceUploadSchema
          : action === "evidence-access"
            ? z.object({ id: z.uuid(), url: z.url() })
            : disputeRecordSchema,
      summary,
      params: id,
      body,
      capability:
        "DISPUTE_MANAGE; STAFF must be an assignee; assignment requires ADMIN or SUPER_ADMIN",
    });
  for (const route of routes) {
    const secured = !route.path.startsWith("/public/");
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Owner policy operations"],
      summary: route.summary,
      ...(route.description ? { description: route.description } : {}),
      ...(route.capability
        ? {
            description: `Required duty: ${route.capability}. Capability is checked against the current active verified account on every action.`,
          }
        : {}),
      ...(route.roles ? { "x-required-roles": route.roles } : {}),
      security: secured ? [{ sessionCookie: [] }] : [],
      request: {
        ...(route.params ? { params: route.params as never } : {}),
        ...(route.query ? { query: route.query as never } : {}),
        ...(route.method === "post" && secured
          ? { headers: z.object({ "x-csrf-token": z.string().min(32) }) as never }
          : {}),
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
          description: route.summary,
          content: {
            "application/json": {
              schema: route.data ? envelope.extend({ data: route.data }) : envelope,
            },
          },
        },
      },
    });
  }
  for (const method of ["get", "post"] as const)
    registry.registerPath({
      method,
      path: "/public/booking-response",
      tags: ["Owner policy operations"],
      summary:
        method === "get"
          ? "Render a read-only attendance confirmation screen"
          : "Confirm attendance or cancel using a purpose-bound expiring token",
      description:
        "Private, no-store, noindex HTML. GET never mutates. HEAD is also read-only; current status determines available controls. POST validates the exact trusted Origin, active verified customer and current booking schedule version. Cancellation is repeat-safe and attendance confirmation is repeat-safe while confirmed. Tokens are private and must not be logged. Invalid/expired or changed links render recovery HTML; uncertain server errors direct the customer to check their account before another action.",
      security: [],
      request:
        method === "get"
          ? { query: bookingActionQuery as never }
          : {
              body: {
                required: true,
                content: {
                  "application/x-www-form-urlencoded": {
                    schema: bookingActionBody,
                  },
                },
              },
            },
      responses: {
        "403": {
          description:
            "Untrusted origin; recovery HTML (global CORS denial may use JSON)",
        },
        "409": {
          description:
            "Invalid, expired, changed or unavailable appointment link; recovery HTML",
        },
        "413": { description: "Form exceeds 4 KiB; recovery HTML" },
        "422": { description: "Invalid query or form; recovery HTML" },
        "500": {
          description: "Result unavailable; recovery HTML without exception details",
        },
        "200": {
          description: "Private HTML confirmation screen",
          content: {
            "text/html": {
              schema: z.string(),
              example: "<!doctype html><title>Appointment confirmation</title>",
            },
          },
        },
      },
    });
}
