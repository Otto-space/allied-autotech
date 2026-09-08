import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  anomalyListQuerySchema,
  anomalyParamsSchema,
  anomalyUpdateBodySchema,
  auditListQuerySchema,
  operationalJobParamsSchema,
  operationalJobsQuerySchema,
  operationalRetryBodySchema,
} from "./audit.schemas.js";

const csrfHeaders = z.object({ "x-csrf-token": z.string().min(32) });
const envelope = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});

export function registerAuditOpenApi(registry: OpenAPIRegistry): void {
  const reads = [
    { path: "/admin/audit", summary: "Search append-only audit events", query: auditListQuerySchema },
    { path: "/admin/operations/status", summary: "Read queue and reconciliation status" },
    { path: "/admin/operations/jobs", summary: "List failed or leased operational jobs", query: operationalJobsQuerySchema },
    { path: "/admin/operations/payment-anomalies", summary: "List payment anomalies", query: anomalyListQuerySchema },
  ] as const;
  for (const route of reads)
    registry.registerPath({
      method: "get",
      path: route.path,
      tags: ["Audit and operations"],
      summary: route.summary,
      security: [{ sessionCookie: [] }],
      request: "query" in route ? { query: route.query as never } : {},
      responses: { "200": { description: "Operational data retrieved", content: { "application/json": { schema: envelope } } } },
    });
  registry.registerPath({
    method: "post",
    path: "/admin/operations/jobs/{source}/{jobId}/retry",
    tags: ["Audit and operations"],
    summary: "Retry a failed job using optimistic attempt matching",
    security: [{ sessionCookie: [] }],
    request: {
      params: operationalJobParamsSchema as never,
      headers: csrfHeaders as never,
      body: { required: true, content: { "application/json": { schema: operationalRetryBodySchema } } },
    },
    responses: { "200": { description: "Retry requested" }, "409": { description: "Job state changed" } },
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
      body: { required: true, content: { "application/json": { schema: anomalyUpdateBodySchema } } },
    },
    responses: { "200": { description: "Anomaly updated" }, "409": { description: "Invalid or stale transition" } },
  });
}
