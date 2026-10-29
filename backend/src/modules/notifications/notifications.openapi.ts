import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  notificationListQuerySchema,
  notificationSummarySchema,
  notificationParamsSchema,
  preferenceUpdateBodySchema,
  preferenceRequestHeadersSchema,
  preferenceResponseSchema,
  preferenceWriteResponseSchema,
} from "./notifications.schemas.js";

const response = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrf = z.object({ "x-csrf-token": z.string().min(32) });

export function registerNotificationsOpenApi(registry: OpenAPIRegistry): void {
  for (const prefix of ["/customers/notifications", "/staff/notifications"] as const) {
    registry.registerPath({
      method: "get",
      path: `${prefix}/summary`,
      tags: ["Notifications"],
      summary: "Count all own unexpired unread notifications by related resource",
      security: [{ sessionCookie: [] }],
      responses: {
        "200": {
          description: "Account-scoped unread counts, independent of inbox pagination",
          content: {
            "application/json": {
              schema: response.extend({ data: notificationSummarySchema }),
            },
          },
        },
      },
    });
    registry.registerPath({
      method: "get",
      path: prefix,
      tags: ["Notifications"],
      summary: "List own notifications",
      security: [{ sessionCookie: [] }],
      request: { query: notificationListQuerySchema as never },
      responses: {
        "200": {
          description: "Notifications retrieved",
          content: { "application/json": { schema: response } },
        },
      },
    });
    registry.registerPath({
      method: "post",
      path: `${prefix}/read-all`,
      tags: ["Notifications"],
      summary: "Mark all own notifications as read",
      security: [{ sessionCookie: [] }],
      request: { headers: csrf as never },
      responses: { "200": { description: "Notifications updated" } },
    });
    registry.registerPath({
      method: "post",
      path: `${prefix}/{notificationId}/read`,
      tags: ["Notifications"],
      summary: "Mark one owned notification as read",
      security: [{ sessionCookie: [] }],
      request: { params: notificationParamsSchema as never, headers: csrf as never },
      responses: { "200": { description: "Notification updated" } },
    });
    registry.registerPath({
      method: "get",
      path: `${prefix}/preferences/current`,
      tags: ["Notifications"],
      summary: "Get mutable operational and marketing preferences",
      security: [{ sessionCookie: [] }],
      responses: {
        "200": {
          description:
            "Preferences retrieved; omitted pairs have version zero and default values",
          content: {
            "application/json": {
              schema: response.extend({
                data: z.object({
                  immutableCategories: z.array(z.enum(["SECURITY", "TRANSACTIONAL"])),
                  preferences: z.array(preferenceResponseSchema),
                }),
              }),
            },
          },
        },
      },
    });
    registry.registerPath({
      method: "put",
      path: `${prefix}/preferences/current`,
      tags: ["Notifications"],
      summary: "Update one mutable notification preference",
      description:
        "Requires expectedVersion (zero for an absent pair) and Idempotency-Key preference-v1.<13-digit Unix milliseconds>.<lowercase UUID v4>. Conflicting revisions return 409 CONFLICT. Original key/body replay within 24 hours returns appliedVersion and current preference without a second consent record or audit; a later withdrawal is never overwritten. Changed content returns 409 IDEMPOTENCY_CONFLICT; expired keys and keys over one minute in the future return 409 IDEMPOTENCY_EXPIRED, including after receipt cleanup. Missing or malformed keys/versions return 422. Replay retains role, CSRF and ownership checks. Marketing dispatch stays disabled. Deploy the revision migration, API and matching clients together.",
      security: [{ sessionCookie: [] }],
      request: {
        headers: csrf.extend(preferenceRequestHeadersSchema.shape) as never,
        body: {
          required: true,
          content: { "application/json": { schema: preferenceUpdateBodySchema } },
        },
      },
      responses: {
        "200": {
          description: "Preference updated or recovered",
          content: {
            "application/json": {
              schema: response.extend({ data: preferenceWriteResponseSchema }),
            },
          },
        },
      },
    });
  }
}
