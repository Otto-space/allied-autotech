import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { pushSubscriptionSchema } from "./push.schemas.js";
import {
  notificationListQuerySchema,
  notificationTargetSchema,
  notificationContextQuerySchema,
  notificationContextReadSchema,
  notificationAttentionQuerySchema,
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
const inboxPage = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      destination: notificationTargetSchema.nullable(),
      type: z.string(),
      category: z.string(),
      title: z.string(),
      message: z.string(),
      resourceType: z.string().nullable(),
      resourceId: z.string().nullable(),
      supportMessageId: z.uuid().nullable(),
      readAt: z.iso.datetime().nullable(),
      expiresAt: z.iso.datetime().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
  nextCursor: z.uuid().optional(),
});
const csrf = z.object({ "x-csrf-token": z.string().min(32) });

export function registerNotificationsOpenApi(registry: OpenAPIRegistry): void {
  for (const prefix of ["/customers/notifications", "/staff/notifications"] as const) {
    for (const [suffix, query, data, summary] of [
      [
        "attention",
        notificationAttentionQuerySchema,
        inboxPage,
        "List unread updates with currently authorized targets in one sidebar section",
      ],
      [
        "context",
        notificationContextQuerySchema,
        z.object({ items: inboxPage.shape.items, hasMore: z.boolean() }),
        "Read own unread updates for one currently authorized record without marking them read",
      ],
    ] as const)
      registry.registerPath({
        method: "get",
        path: `${prefix}/${suffix}`,
        tags: ["Notifications"],
        summary,
        security: [{ sessionCookie: [] }],
        request: { query: query as never },
        responses: {
          "200": {
            description:
              "Recipient and current target access checked; no read or business status changes",
            content: { "application/json": { schema: response.extend({ data }) } },
          },
          "404": { description: "Target or cursor unavailable" },
        },
      });
    registry.registerPath({
      method: "post",
      path: `${prefix}/read-context`,
      tags: ["Notifications"],
      summary:
        "Idempotently acknowledge displayed notifications for one authorized record",
      description:
        "Called only after the record and relevant message are displayed. Every supplied ID must belong to this recipient and exact target, be unexpired and still accessible. Repeated calls do not change the original read time. Does not change any business status. Manual individual and bulk read operations remain available.",
      security: [{ sessionCookie: [] }],
      request: {
        headers: csrf as never,
        body: {
          required: true,
          content: { "application/json": { schema: notificationContextReadSchema } },
        },
      },
      responses: {
        "200": {
          description: "Confirmed number newly read",
          content: {
            "application/json": {
              schema: response.extend({
                data: z.object({ updated: z.number().int().nonnegative() }),
              }),
            },
          },
        },
        "404": {
          description:
            "A supplied notification or its current target is unavailable; no read changes applied",
        },
      },
    });
    registry.registerPath({
      method: "get",
      path: `${prefix}/{notificationId}`,
      tags: ["Notifications"],
      summary: "Read one owned unexpired notification",
      security: [{ sessionCookie: [] }],
      request: { params: notificationParamsSchema as never },
      responses: {
        "200": {
          description: "Owned notification",
          content: {
            "application/json": {
              schema: response.extend({ data: inboxPage.shape.items.element }),
            },
          },
        },
        "404": { description: "Notification unavailable" },
      },
    });
    registry.registerPath({
      method: "get",
      path: `${prefix}/push`,
      tags: ["Notifications"],
      summary: "Read browser push availability and current session subscription status",
      security: [{ sessionCookie: [] }],
      responses: {
        "200": {
          description: "Browser push settings",
          content: {
            "application/json": {
              schema: response.extend({
                data: z.object({
                  available: z.boolean(),
                  publicKey: z.string().nullable(),
                  enabled: z.boolean(),
                }),
              }),
            },
          },
        },
      },
    });
    registry.registerPath({
      method: "put",
      path: `${prefix}/push`,
      tags: ["Notifications"],
      summary: "Opt this session into browser push",
      security: [{ sessionCookie: [] }],
      request: {
        headers: csrf as never,
        body: {
          required: true,
          content: { "application/json": { schema: pushSubscriptionSchema } },
        },
      },
      responses: {
        "200": { description: "Subscription saved" },
        "409": { description: "Unavailable or endpoint belongs to another account" },
      },
    });
    registry.registerPath({
      method: "delete",
      path: `${prefix}/push`,
      tags: ["Notifications"],
      summary: "Disable browser push for this session only",
      security: [{ sessionCookie: [] }],
      request: { headers: csrf as never },
      responses: { "200": { description: "Subscription disabled" } },
    });
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
          content: {
            "application/json": { schema: response.extend({ data: inboxPage }) },
          },
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
