import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { fitmentRouteDefinitions } from "./fitment.routes.js";
import { fitmentResponseSchemas } from "./fitment.schemas.js";

export function registerFitmentOpenApi(registry: OpenAPIRegistry) {
  for (const [method, path, action, schema, params] of fitmentRouteDefinitions) {
    registry.registerPath({
      method,
      path: path.replace(/:([A-Za-z]+)/g, "{$1}"),
      tags: ["Parts fitment"],
      ...(path.startsWith("/staff/") ? { security: [{ sessionCookie: [] }] } : {}),
      summary: `Vehicle catalogue and reviewed parts fitment: ${action}`,
      description:
        "Make/model/year identifies candidates only. Exact fit requires approved evidence, matching required technical qualifiers and no possible approved exclusion. Public reads omit draft/rejected rules. Staff requests revalidate current MFA, assignment and branch scope in a transaction. Sales/Operations author; Workshop/Quality or the owner review; authors and last editors cannot approve their own rules. Mutations record immutable version history. Stale versions and duplicate semantic rules conflict. Legacy rules remain draft until normalized and reviewed. No sale stock, checkout, inventory quantities or workflow completion is changed.",
      request: {
        params: params as never,
        ...(method === "get"
          ? { query: schema as never }
          : {
              headers: z.object({ "x-csrf-token": z.string().min(32) }),
              body: { required: true, content: { "application/json": { schema } } },
            }),
      },
      responses: {
        "200": {
          description: "Current scoped fitment result",
          content: {
            "application/json": {
              schema: z.object({
                success: z.literal(true),
                message: z.string(),
                data: fitmentResponseSchemas[action],
                meta: z.object({ requestId: z.string(), serverTime: z.string() }),
              }),
            },
          },
        },
        "401": { description: "Authentication required for staff routes" },
        "403": {
          description:
            "Current MFA, branch or responsibility does not permit this action",
        },
        "404": { description: "Record is unavailable in this scope" },
        "409": {
          description: "Stale version, duplicate rule or invalid review transition",
        },
        "422": {
          description: "Invalid fields, vehicle relationship or incomplete evidence",
        },
      },
    });
  }
}
