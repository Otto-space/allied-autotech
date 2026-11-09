import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { orderParamsSchema, ordersEmptyQuerySchema } from "./orders.schemas.js";
import {
  pickupIssueSchema,
  pickupRevokeSchema,
  pickupVerifySchema,
  pickupHandoverSchema,
  pickupCancelClaimSchema,
} from "./order-pickup.schemas.js";

export function registerPickupOpenApi(registry: OpenAPIRegistry) {
  const response = z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.unknown().optional(),
    meta: z.object({ requestId: z.string() }),
  });
  for (const prefix of ["/customers/orders", "/purchase/orders", "/staff/orders"]) {
    const staff = prefix.startsWith("/staff"),
      guest = prefix.startsWith("/purchase");
    const writes: (readonly [string, z.ZodType, string])[] = staff
      ? [
          [
            "/cancel-review",
            pickupCancelClaimSchema,
            "Resolve a pickup review only after confirming goods were not handed over; revoke its old code",
          ],
          [
            "/verify",
            pickupVerifySchema,
            "Claim an exclusive session-bound review of private code, exact goods and current payment clearance",
          ],
          [
            "/handover",
            pickupHandoverSchema,
            "Consume private authorisation and record confirmed physical handover transactionally",
          ],
        ]
      : [
          [
            "",
            pickupIssueSchema,
            "Issue or replace an owned ready order's private one-time pickup authorisation",
          ],
          [
            "/revoke",
            pickupRevokeSchema,
            "Revoke an owned unused pickup authorisation without altering payment or goods",
          ],
        ];

    const description =
      "Private/no-store and sensitive-rate-limited. Current principal/branch checks are authoritative. Raw pickupCode stays in authenticated response/request memory, never in a URL or stored history. No public order reference is collection authority. Issue/handover use body UUID replay keys; an issuance replay cannot redisplay a secret. Payment, allocation, actual readiness, partial handover and holding deadlines remain separate. Engineering security expiry is not an owner-approved holding deadline. This operation moves no money. Guest mutations require trusted Origin plus the purchase-session CSRF header; account mutations use their current session CSRF protection.";
    registry.registerPath({
      method: "get",
      path: `${prefix}/{orderId}/pickup`,
      summary:
        "Read authorised collection quantities and safe history without secret or financial proof disclosure",
      description,
      security: [guest ? { purchaseGuestCookie: [] } : { sessionCookie: [] }],
      request: {
        params: orderParamsSchema,
        query: ordersEmptyQuerySchema.removeDefault(),
      },
      responses: {
        200: {
          description: "Private collection summary",
          content: { "application/json": { schema: response } },
        },
      },
    });
    for (const [suffix, body, summary] of writes)
      registry.registerPath({
        method: "post",
        path: `${prefix}/{orderId}/pickup${suffix}`,
        summary,
        description,
        security: [guest ? { purchaseGuestCookie: [] } : { sessionCookie: [] }],
        request: {
          params: orderParamsSchema,
          query: ordersEmptyQuerySchema.removeDefault(),
          headers: z.looseObject({ "x-csrf-token": z.string().min(32) }),
          body: { required: true, content: { "application/json": { schema: body } } },
        },
        responses: {
          200: {
            description: "Private collection result; issuance secrets are shown once",
            content: { "application/json": { schema: response } },
          },
        },
      });
  }
}
