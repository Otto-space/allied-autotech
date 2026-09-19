import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { overviewQuerySchema, overviewResponseSchema } from "./overview.schemas.js";

export function registerOverviewOpenApi(registry: OpenAPIRegistry): void {
  for (const audience of ["customers", "staff"])
    registry.registerPath({
      method: "get",
      path: `/${audience}/overview`,
      tags: ["Overview"],
      security: [{ sessionCookie: [] }],
      summary:
        audience === "customers"
          ? "Read own date-filtered dashboard aggregates"
          : "Read role-scoped dashboard aggregates; financial totals are administrator-only",
      description:
        "Inclusive Africa/Lagos calendar range, maximum 90 days. Scope derives from the authenticated actor, with active-branch enforcement for STAFF. Booking/order/inspection/vehicle counts use creation dates; quotations use issue dates. Status breakdowns reflect current status. Administrator payment sums use succeededAt and verified settled attempts; refunds use processedAt. Currencies remain separate. Recent records are bounded previews, never the source of aggregate counts.",
      request: { query: overviewQuerySchema as never },
      responses: {
        "200": {
          description: "Consistent scoped snapshot",
          content: {
            "application/json": {
              schema: z.object({
                success: z.literal(true),
                message: z.string(),
                data: overviewResponseSchema,
                meta: z.object({ requestId: z.string() }),
              }),
            },
          },
        },
      },
    });
}
