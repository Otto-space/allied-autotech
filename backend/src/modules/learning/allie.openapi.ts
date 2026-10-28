import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { env } from "../../config/env.js";
import {
  allieConversationParams,
  allieCreateSchema,
  allieEmptySchema,
  allieResponseSchemas,
  allieTurnSchema,
} from "./allie.schemas.js";
export function registerAllieOpenApi(registry: OpenAPIRegistry) {
  registry.registerComponent("securitySchemes", "assistantGuestCookie", {
    type: "apiKey",
    in: "cookie",
    name: env.NODE_ENV === "production" ? "__Host-aat_help" : "aat_help",
    description: "Opaque guest-help session only; it grants no account access.",
  });
  for (const [prefix, guest] of [
    ["/public/learning/assistant", true],
    ["/learning/assistant", false],
  ] as const) {
    const routes = [
      { method: "get", path: "/conversations", kind: "list" },
      { method: "post", path: "/conversations", kind: "create", body: allieCreateSchema },
      { method: "get", path: "/conversations/{conversationId}", kind: "read" },
      {
        method: "delete",
        path: "/conversations/{conversationId}",
        kind: "clear",
        body: allieEmptySchema,
      },
      {
        method: "post",
        path: "/conversations/{conversationId}/cancel",
        kind: "cancel",
        body: allieCreateSchema,
      },
      {
        method: "post",
        path: "/conversations/{conversationId}/turns",
        kind: "turns",
        body: allieTurnSchema,
      },
      ...(guest
        ? [
            {
              method: "post",
              path: "/session",
              kind: "session",
              body: allieEmptySchema,
            } as const,
          ]
        : []),
    ] as const;
    for (const route of routes)
      registry.registerPath({
        method: route.method,
        path: prefix + route.path,
        tags: ["Allie assistance"],
        security: !guest
          ? [{ sessionCookie: [] }]
          : route.kind === "session"
            ? []
            : [{ assistantGuestCookie: [] }],
        summary: `Allie ${route.kind}`,
        description:
          "Disabled by default. Requires enabled reviewed learning, server-only provider settings and a positive shared daily reservation budget. Current verified identity/MFA and session-bound ownership are resolved on every protected operation. Public sessions are separate secure opaque cookies and never silently join an account. All writes require trusted Origin; account writes use existing CSRF, guest writes additionally verify the guest CSRF header. Conversation and turn creation use scoped operation IDs. Only typed questions and eligible reviewed help reach the provider; no business lookup/mutation tools. Output sources/actions are validated, state encrypted with short expiry, budget/concurrency shared in PostgreSQL. Persistence is automated help, not a Customer Care case, live staffing or human delivery. All responses private/no-store; no transcript URL parameters. Limited catalogue mode retains its public-write restrictions.",
        request: {
          query: allieEmptySchema,
          ...(route.method !== "get"
            ? {
                headers: z.object({
                  origin: z.url(),
                  ...(route.kind !== "session"
                    ? { "x-csrf-token": z.string().min(32).max(256) }
                    : {}),
                }),
              }
            : {}),
          ...(route.path.includes("{conversationId}")
            ? { params: allieConversationParams }
            : {}),
          ...("body" in route
            ? {
                body: {
                  required: true,
                  content: { "application/json": { schema: route.body } },
                },
              }
            : {}),
        },
        responses: {
          "200": {
            description: "Current owned assistance state",
            content: {
              "application/json": {
                schema: z.object({
                  success: z.literal(true),
                  message: z.string(),
                  data: allieResponseSchemas[route.kind],
                  meta: z.object({ requestId: z.string(), serverTime: z.string() }),
                }),
              },
            },
          },
          "401": { description: "Current account session required" },
          "403": {
            description: "Current assurance, CSRF, Origin or release restriction",
          },
          "404": {
            description:
              "Disabled, expired or unavailable to this owner; no existence disclosure",
          },
          "409": {
            description:
              "Pending, uncertain, cancelled, changed context or conflicting operation; never automatically replay generation",
          },
          "422": {
            description:
              "Strict bounded payload; unsupported context or obvious sensitive input rejected",
          },
          "429": {
            description:
              "Shared rate, concurrency or conservative token reservation limit; ordinary help/support unaffected",
          },
          "503": {
            description:
              "Provider/configuration/output verification unavailable; no fabricated AI answer",
          },
        },
      });
  }
}
