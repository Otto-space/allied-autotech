import { auditPageResponseSchema } from "./audit-response.schemas.js";
import {
  operationalJobsResponseSchema,
  operationalRetryResponseSchema,
  operationsStatusResponseSchema,
} from "./operations-response.schemas.js";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { disputeRecordSchema } from "../payments/disputes.schemas.js";
import {
  anomalyListQuerySchema,
  anomalyParamsSchema,
  anomalyUpdateBodySchema,
  auditListQuerySchema,
  disputeListQuerySchema,
  operationalJobParamsSchema,
  operationalJobsQuerySchema,
  operationalRetryBodySchema,
  refundListQuerySchema,
} from "./audit.schemas.js";

const csrfHeaders = z.object({ "x-csrf-token": z.string().min(32) });
const envelope = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const disputeOverviewSchema = disputeRecordSchema.pick({
  id: true,
  paymentAttemptId: true,
  provider: true,
  providerDisputeId: true,
  status: true,
  category: true,
  amountKobo: true,
  currency: true,
  chargebackAmountKobo: true,
  providerStatus: true,
  providerResolution: true,
  providerReviewReason: true,
  providerUpdatedAt: true,
  responseDueAt: true,
  openedAt: true,
  respondedAt: true,
  resolvedAt: true,
  hasEvidence: true,
  updatedAt: true,
});

export function registerAuditOpenApi(registry: OpenAPIRegistry): void {
  const reads = [
    {
      path: "/admin/audit",
      summary: "Search append-only audit events",
      query: auditListQuerySchema,
    },
    { path: "/admin/operations/status", summary: "Read queue and reconciliation status" },
    {
      path: "/admin/operations/jobs",
      summary: "List failed or leased operational jobs",
      query: operationalJobsQuerySchema,
    },
    {
      path: "/admin/operations/payment-anomalies",
      summary: "List payment anomalies",
      query: anomalyListQuerySchema,
    },
    {
      path: "/admin/operations/payment-disputes",
      summary: "List payment disputes without private evidence keys",
      query: disputeListQuerySchema,
    },
    {
      path: "/admin/operations/payment-refunds",
      summary: "List refunds requiring operational action",
      query: refundListQuerySchema,
    },
  ] as const;
  for (const route of reads)
    registry.registerPath({
      method: "get",
      path: route.path,
      tags: ["Audit and operations"],
      summary: route.summary,
      ...(route.path === "/admin/audit"
        ? {
            description:
              "Admin/Super Admin only with verified privileged session. Private, no-store. Supports every recorded audit action and entity type, including failed logins, booking slots and service categories. Bounded 1 to 100 rows (default 25), ordered by createdAt and ID descending; copy nextCursor unchanged. Successful reads append a READ audit. Both date bounds, when supplied, must be ordered and span at most 90 days. Actor IDs and current roles are returned without account credentials, IP addresses or user agents. Before/after values are nullable selected JSON objects, not complete resource snapshots. Pagination is live, not a snapshot.",
          }
        : route.path === "/admin/operations/status"
          ? {
              description:
                "Admin/Super Admin only with verified privileged session. Private, no-store. Current organisation-wide grouped queue counts; absent queue/status groups have zero rows. Includes latest-started reconciliation, open/investigating anomaly count, oldest 100 unresolved alerts and configured expected worker heartbeats. Missing means no heartbeat; overdue means no successful heartbeat within staleAfterMs. A recent success does not prove a currently live worker or provider delivery. No filters accepted.",
            }
          : route.path === "/admin/operations/jobs"
            ? {
                description:
                  "Admin/Super Admin only with verified privileged session. Private, no-store. Bounded 1 to 100 records (default 25), ordered by updatedAt, ID and source descending across outbox/webhook queues. Copy the returned opaque nextCursor unchanged. It is signed and bound to the current actor and source/status filters; changing filters or actor, tampering, legacy UUID cursors or key rotation requires restarting from the first page (422). Limit may change. Cursor contains its original boundary so retrying or deleting its job does not restart or repeat the first page. This is live keyset paging, not a snapshot: updated jobs may move to newer pages. Refresh page one for recent changes. Payloads, signatures and provider credentials are excluded. Every successful read is audited.",
              }
            : {}),
      security: [{ sessionCookie: [] }],
      request: "query" in route ? { query: route.query as never } : {},
      responses: {
        "200": {
          description: "Operational data retrieved",
          content: {
            "application/json": {
              schema:
                route.path === "/admin/audit"
                  ? envelope.extend({ data: auditPageResponseSchema })
                  : route.path === "/admin/operations/payment-disputes"
                    ? envelope.extend({
                        data: z.object({
                          items: z.array(disputeOverviewSchema),
                          nextCursor: z.uuid().optional(),
                        }),
                      })
                    : route.path === "/admin/operations/jobs"
                      ? envelope.extend({ data: operationalJobsResponseSchema })
                      : route.path === "/admin/operations/status"
                        ? envelope.extend({ data: operationsStatusResponseSchema })
                        : envelope,
            },
          },
        },
      },
    });
  registry.registerPath({
    method: "post",
    path: "/admin/operations/jobs/{source}/{jobId}/retry",
    tags: ["Audit and operations"],
    summary: "Retry a failed job using optimistic attempt matching",
    description:
      "Requires Admin or Super Admin, verified MFA and CSRF. expectedAttempts must match the current job, including zero for notifications queued while delivery was disabled. Only FAILED or DEAD_LETTER jobs are retryable. Notification outbox retries atomically reset their matching failed delivery and append an audit event; missing, active, completed or mismatched delivery records return 409 without changing the job. Attempts and provider idempotency keys are preserved. A webhook retry queues one further attempt even after its automatic eight-attempt budget is exhausted; failure after that budget returns to DEAD_LETTER, and a further retry requires another audited request. RETRY_REQUESTED means queued, not delivered or settled; workers still enforce consent, message eligibility, provider verification and financial authorization.",
    security: [{ sessionCookie: [] }],
    request: {
      params: operationalJobParamsSchema as never,
      headers: csrfHeaders as never,
      body: {
        required: true,
        content: { "application/json": { schema: operationalRetryBodySchema } },
      },
    },
    responses: {
      "200": {
        description: "Retry requested",
        content: {
          "application/json": {
            schema: envelope.extend({ data: operationalRetryResponseSchema }),
          },
        },
      },
      "409": { description: "Job or linked notification delivery state changed" },
    },
  });
  registry.registerPath({
    method: "post",
    path: "/admin/operations/payment-anomalies/{anomalyId}/status",
    tags: ["Audit and operations"],
    summary: "Transition a payment anomaly investigation",
    security: [{ sessionCookie: [] }],
    request: {
      params: anomalyParamsSchema as never,
      headers: csrfHeaders as never,
      body: {
        required: true,
        content: { "application/json": { schema: anomalyUpdateBodySchema } },
      },
    },
    responses: {
      "200": { description: "Anomaly updated" },
      "409": { description: "Invalid or stale transition" },
    },
  });
}
