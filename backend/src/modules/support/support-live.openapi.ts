import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  supportCoverageSchema,
  supportCoverageUpdateSchema,
  supportCoverageOperationParamsSchema,
  supportCoverageRecoverySchema,
  supportLiveAvailabilityQuerySchema,
  supportLiveAvailabilitySchema,
  supportLiveBranchSchema,
  supportPresenceHeartbeatSchema,
  supportPresenceSchema,
  supportPresenceUpdateSchema,
} from "./support-live.schemas.js";
import { supportReplyKeySchema } from "./support.schemas.js";

export function registerSupportLiveOpenApi(registry: OpenAPIRegistry) {
  const content = (schema: z.ZodType) => ({ "application/json": { schema } });
  const response = (data: z.ZodType) => ({
    description: "Current private, no-store projection",
    content: content(
      z.object({
        success: z.boolean(),
        message: z.string(),
        data,
        meta: z.object({ requestId: z.string() }),
      }),
    ),
  });
  const failures = Object.fromEntries(
    [
      [401, "Current session required"],
      [403, "Current identity, MFA, responsibilities or CSRF denied"],
      [404, "Active branch unavailable"],
      [409, "Stale revision, expired lease or changed coverage"],
      [422, "Strict bounded input invalid"],
      [429, "Rate limit reached"],
      [
        503,
        "Live feature or explicit coverage unavailable; ordinary queued Care remains",
      ],
    ].map(([code, description]) => [code, { description: String(description) }]),
  );
  const csrf = z.object({ "x-csrf-token": z.string().min(32) });
  const rows = [
    ...(["get", "delete"] as const).map((method) => ({
      method,
      path: "/admin/workforce/support-chat/coverage/{branchId}/operations/{key}",
      summary:
        method === "get"
          ? "Owner recovers the saved coverage reference without resending its command"
          : "Owner cancels an unsaved coverage reference while preserving a committed change",
      params: supportCoverageOperationParamsSchema,
      output: supportCoverageRecoverySchema,
    })),
    {
      method: "get",
      path: "/customers/support/live/availability/{branchId}",
      summary: "Check current staffed eligibility without promising live transport",
      params: supportLiveBranchSchema,
      query: supportLiveAvailabilityQuerySchema,
      output: supportLiveAvailabilitySchema,
    },
    {
      method: "get",
      path: "/admin/workforce/support-chat/coverage/{branchId}",
      summary: "Owner reads explicit support coverage, independent of workshop hours",
      params: supportLiveBranchSchema,
      output: supportCoverageSchema,
    },
    {
      method: "put",
      path: "/admin/workforce/support-chat/coverage/{branchId}",
      summary: "Owner updates audited support coverage using its current revision",
      params: supportLiveBranchSchema,
      body: supportCoverageUpdateSchema,
      output: supportCoverageSchema,
    },
    {
      method: "get",
      path: "/staff/workforce/support-chat/presence",
      summary: "Read your explicit availability and current branch live duties",
      output: supportPresenceSchema,
    },
    {
      method: "put",
      path: "/staff/workforce/support-chat/presence",
      summary: "Opt in or withdraw one shared, session-bound availability lease",
      body: supportPresenceUpdateSchema,
      output: supportPresenceSchema,
    },
    {
      method: "post",
      path: "/staff/workforce/support-chat/presence/heartbeat",
      summary:
        "Renew an unexpired current lease without multiplying capacity or revisions",
      body: supportPresenceHeartbeatSchema,
      output: supportPresenceSchema,
    },
  ] as const;
  for (const row of rows)
    registry.registerPath({
      method: row.method,
      path: row.path,
      summary: row.summary,
      tags: ["Support"],
      description:
        "Gated additive availability foundation. No chat claim, message delivery or queue-position promise. Current branch duties and session are checked server-side. Customer responses contain no staff identities; the channel remains queued Customer Care until lifecycle and transport acceptance. Default feature flag is off.",
      security: [{ sessionCookie: [] }],
      request: {
        ...(row.method !== "get"
          ? {
              headers:
                row.method === "put" && row.path.includes("/coverage/")
                  ? csrf.extend({ "idempotency-key": supportReplyKeySchema.optional() })
                  : csrf,
            }
          : {}),
        ...("params" in row ? { params: row.params } : {}),
        query: "query" in row ? row.query : z.strictObject({}),
        ...("body" in row
          ? { body: { required: true, content: content(row.body) } }
          : {}),
      },
      responses: { 200: response(row.output), ...failures },
    });
}
