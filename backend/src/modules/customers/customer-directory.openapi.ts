import {
  extendZodWithOpenApi,
  type OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  directoryCollections,
  customerAccountStatusSchema,
  directoryDetailSchema,
  directoryListQuerySchema,
  directoryPageSchema,
  directoryParamsSchema,
  directoryRelatedPageSchema,
  directoryRelatedQuerySchema,
} from "./customer-directory.schemas.js";

export function registerCustomerDirectoryOpenApi(registry: OpenAPIRegistry) {
  extendZodWithOpenApi(z);
  registry.register("CustomerDirectoryRow", directoryPageSchema.shape.items.element);
  registry.register("CustomerDirectoryDetail", directoryDetailSchema);
  registry.register("CustomerDirectoryPage", directoryPageSchema);
  registry.register("CustomerRelatedPage", directoryRelatedPageSchema);
  registry.registerPath({
    method: "post",
    path: "/admin/customers/{customerId}/account-status",
    tags: ["Customers"],
    summary: "Suspend or reactivate a current customer account",
    description:
      "MFA-verified administrator, current actor/session/target role revalidated transactionally. CSRF required. Expected status guards stale/concurrent changes; DEACTIVATED and non-customer targets are excluded. Suspension revokes sessions and unused reset/verification tokens. Reactivation never revives revoked credentials. Actor, target, reason, time and transition audited. No financial/history or outbound email side effects.",
    security: [{ sessionCookie: [] }],
    request: {
      params: directoryParamsSchema,
      query: z.object({}).strict(),
      headers: z.object({ "x-csrf-token": z.string().min(32) }),
      body: {
        required: true,
        content: { "application/json": { schema: customerAccountStatusSchema } },
      },
    },
    responses: {
      200: {
        description: "Account state changed",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(true),
              message: z.string(),
              data: z.object({
                customerId: z.uuid(),
                status: z.enum(["ACTIVE", "SUSPENDED"]),
                revokedSessions: z.number().int().nonnegative(),
              }),
              meta: z.object({ requestId: z.string(), serverTime: z.iso.datetime() }),
            }),
          },
        },
      },
      403: { description: "Not authorised" },
      404: { description: "Current customer unavailable" },
      409: { description: "Account state changed" },
      422: { description: "Invalid fields" },
    },
  });
  const routes = [
    {
      path: "/admin/customers",
      schema: directoryPageSchema,
      query: directoryListQuerySchema,
      summary: "Search the customer directory",
      detail: false,
    },
    {
      path: "/admin/customers/{customerId}",
      schema: directoryDetailSchema,
      query: z.object({}).strict(),
      summary: "Read a bounded customer summary",
      detail: true,
    },
    ...directoryCollections.map((collection) => ({
      path: `/admin/customers/{customerId}/${collection}`,
      schema: directoryRelatedPageSchema,
      query: directoryRelatedQuerySchema,
      summary: `List customer ${collection}`,
      detail: true,
    })),
  ];
  for (const route of routes)
    registry.registerPath({
      method: "get",
      path: route.path,
      tags: ["Customers"],
      summary: route.summary,
      description:
        "MFA-verified Admin/Super Admin only; Staff and Customers denied. Read-only, private/no-store; reads audited without search text or returned PII. Customer IDs identify CustomerProfile records. Search is trimmed, whitespace-collapsed, case-insensitive prefix matching by selected field: full name or surname, email, or phone digits with punctuation removed (no country-code inference). ID requires an exact UUID. Empty search lists all customers. Name/email minimum 2 characters; phone minimum 3 digits; maximum 120 characters. Sort allowlist newest/oldest uses immutable account registration time then unique user ID. Opaque keyset cursors are bound to normalized filters and sorting, not a snapshot: new/changed matches may appear on subsequent pages; restart to refresh. No totals. Related endpoints independently authorize their domain and return at most 50 minimal summaries, ordered by ID. Private media and payment credentials are excluded. No mutation, CSRF or idempotency key is required for these GET operations.",
      security: [{ sessionCookie: [] }],
      request: {
        query: route.query,
        ...(route.detail ? { params: directoryParamsSchema } : {}),
      },
      responses: {
        200: {
          description: "Authorized result",
          content: {
            "application/json": {
              schema: z.object({
                success: z.literal(true),
                message: z.string(),
                data: route.schema,
                meta: z.object({ requestId: z.string(), serverTime: z.iso.datetime() }),
              }),
            },
          },
        },
      },
    });
}
