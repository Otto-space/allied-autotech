import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { orderParamsSchema, ordersEmptyQuerySchema } from "./orders.schemas.js";
import { supplyExceptionRaiseSchema } from "./order-supply-exception.schemas.js";
export function registerSupplyExceptionOpenApi(registry: OpenAPIRegistry) {
  const response = z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.unknown().optional(),
    meta: z.object({ requestId: z.string() }),
  });
  for (const prefix of ["/customers/orders", "/purchase/orders", "/staff/orders"]) {
    const guest = prefix.startsWith("/purchase"),
      staff = prefix.startsWith("/staff");
    registry.registerPath({
      method: "get",
      path: `${prefix}/{orderId}/supply-exceptions`,
      summary: "Read current owned/scoped supply concerns and safe Care references",
      description:
        "Private/no-store. Actual current account/guest ownership or staff MFA and branch access is rechecked. Raw administrator notes, request hashes, replay keys and operator/session identities are omitted from buyer projections. A concern and monetary basis are review evidence, not technical approval, refund approval or successful settlement. A used/installed/diagnosis report requires technical assessment; general returns and warranty remain unresolved.",
      security: [guest ? { purchaseGuestCookie: [] } : { sessionCookie: [] }],
      request: {
        params: orderParamsSchema,
        query: ordersEmptyQuerySchema.removeDefault(),
      },
      responses: {
        200: {
          description: "Private bounded supply-concern history",
          content: { "application/json": { schema: response } },
        },
      },
    });
    if (staff)
      registry.registerPath({
        method: "post",
        path: `${prefix}/{orderId}/supply-exceptions`,
        summary:
          "Record actual affected quantities and alert existing Customer Care without moving money",
        description:
          "Current Admin/Super Admin, verified MFA and CSRF. Locks actual order/version and current identity; validates disjoint owned unit ranges and refuses overlap with existing concerns. Replays the same body UUID without a duplicate Care case or alert. Immutable original allocation is retained where available, otherwise financial reconciliation is required; never reprice a historical invoice or deduct a handling fee. Existing Care notifications and opt-in department delivery are reused. A queued message is not successful delivery. This does not grant refund/credit authority, customer consent or settlement.",
        security: [{ sessionCookie: [] }],
        request: {
          params: orderParamsSchema,
          query: ordersEmptyQuerySchema.removeDefault(),
          headers: z.looseObject({ "x-csrf-token": z.string().min(32) }),
          body: {
            required: true,
            content: { "application/json": { schema: supplyExceptionRaiseSchema } },
          },
        },
        responses: {
          200: {
            description:
              "Supply concern saved; money, collection and remedy remain separate",
            content: { "application/json": { schema: response } },
          },
        },
      });
  }
}
