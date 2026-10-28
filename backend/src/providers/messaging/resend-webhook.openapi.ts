import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

export function registerResendWebhookOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/webhooks/resend",
    tags: ["Notifications"],
    summary: "Receive a signed Resend email outcome",
    description:
      "The exact raw JSON and Svix headers are signature-checked before processing. Only tagged Support email outcomes are retained. Duplicate events are acknowledged idempotently. Provider delivery to a mail server does not prove inbox placement or reading.",
    request: {
      headers: z.object({
        "svix-id": z.string(),
        "svix-timestamp": z.string(),
        "svix-signature": z.string(),
      }),
    },
    responses: {
      "204": { description: "Verified event accepted or safely ignored" },
      "401": { description: "Invalid signature" },
      "503": { description: "Webhook secret not configured" },
    },
  });
}
