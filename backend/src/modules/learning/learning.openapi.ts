import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { registerAllieOpenApi } from "./allie.openapi.js";
import {
  learningResponseSchemas,
  learningParams,
  learningQuery,
} from "./learning.schemas.js";
export function registerLearningOpenApi(registry: OpenAPIRegistry) {
  registerAllieOpenApi(registry);
  for (const prefix of ["/public/learning", "/learning"])
    for (const kind of ["catalogue", "articles", "guides", "scenarios"] as const)
      registry.registerPath({
        method: "get",
        path: prefix + "/" + kind + (kind === "catalogue" ? "" : "/{id}"),
        tags: ["Help & Learn"],
        ...(prefix === "/learning" ? { security: [{ sessionCookie: [] }] } : {}),
        summary: "Read eligible " + kind,
        description:
          "Read-only versioned learning content. Catalogue q matches eligible articles, guides and practice separately using task synonyms and their eligible parent article context. Public routes always omit restricted titles, bodies, guides and fixtures. Protected reads resolve current identity, MFA and effective assignments server-side; client roles/owner IDs are not accepted. All responses are private/no-store and vary by Cookie. No AI, account lookup, progress mutation or training/live operational writes.",
        request: {
          query: kind === "catalogue" ? learningQuery : z.strictObject({}),
          params: kind === "catalogue" ? z.strictObject({}) : learningParams,
        },
        responses: {
          "200": {
            description: "Eligible reviewed content",
            content: {
              "application/json": {
                schema: z.object({
                  success: z.literal(true),
                  message: z.string(),
                  data: learningResponseSchemas[kind],
                  meta: z.object({ requestId: z.string(), serverTime: z.string() }),
                }),
              },
            },
          },
          "401": { description: "Current session required" },
          "403": { description: "Current assurance/access unavailable" },
          "404": {
            description:
              "Disabled, unpublished or unavailable; no restricted existence disclosure",
          },
          "422": { description: "Invalid query or definition ID" },
        },
      });
}
