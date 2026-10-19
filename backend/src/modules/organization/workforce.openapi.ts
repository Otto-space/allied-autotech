import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { workforceRouteDefinitions } from "./workforce.routes.js";
import { workforceResponseSchema } from "./workforce.schemas.js";

export function registerWorkforceOpenApi(registry: OpenAPIRegistry) {
  for (const [method, path, action, schema, params] of workforceRouteDefinitions)
    registry.registerPath({
      method,
      path: path.replace(/:([A-Za-z]+)/g, "{$1}"),
      tags: ["Workforce"],
      security: [{ sessionCookie: [] }],
      summary: `Responsibility-based workspace: ${action}`,
      description:
        "Explicit enrollment required for operational queues. Current assignments, branch, field projections and state are enforced in a transaction. Access changes require MFA, current password, target/version review and an owner-configured delegation envelope. No financial execution, exports or collection release authority is conferred by a title.",
      request: {
        ...(method === "get"
          ? {}
          : { headers: z.object({ "x-csrf-token": z.string().min(32) }) }),
        params: params as never,
        ...(method === "get"
          ? { query: schema as never }
          : { body: { required: true, content: { "application/json": { schema } } } }),
      },
      responses: {
        "200": {
          description: "Current scoped result",
          content: {
            "application/json": {
              schema: z.object({
                success: z.literal(true),
                message: z.string(),
                data: workforceResponseSchema(action),
                meta: z.object({ requestId: z.string(), serverTime: z.string() }),
              }),
            },
          },
        },
        "403": { description: "Current access does not permit this request" },
        "404": { description: "Record unavailable in permitted scope" },
        "409": { description: "Stale version or invalid state" },
        "422": { description: "Invalid fields" },
      },
    });
}
