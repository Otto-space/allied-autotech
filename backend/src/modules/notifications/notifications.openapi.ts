import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  notificationListQuerySchema,
  notificationParamsSchema,
  preferenceUpdateBodySchema,
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
      responses: { "200": { description: "Preferences retrieved" } },
    });
    registry.registerPath({
      method: "put",
      path: `${prefix}/preferences/current`,
      tags: ["Notifications"],
      summary: "Update one mutable notification preference",
      security: [{ sessionCookie: [] }],
      request: {
        headers: csrf as never,
        body: {
          required: true,
          content: { "application/json": { schema: preferenceUpdateBodySchema } },
        },
      },
      responses: { "200": { description: "Preference updated" } },
    });
  }
}
