import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { orderParamsSchema, ordersEmptyQuerySchema } from "./orders.schemas.js";
import {
  supplyExceptionRaiseSchema,
  supplyRemedyChoiceSchema,
  supplyResolutionSchema,
  supplyClosureSchema,
} from "./order-supply-exception.schemas.js";
export function registerSupplyExceptionOpenApi(registry: OpenAPIRegistry) {
  const response = z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.unknown().optional(),
    meta: z.object({ requestId: z.string() }),
  });
  registry.registerPath({
    method: "post",
    path: "/staff/orders/{orderId}/supply-exceptions/close",
    summary:
      "Close actual resolved supply obligations without inventing a handover or stock return",
    description:
      "Current administrator MFA, CSRF, exact order version and UUID replay. An already cancelled original order may instead record no captured payment with no payment attempts, or independently verified full return of every capture (including technical/legacy refunds) without inventing a unit allocation. Pending/uncertain attempts, active claims, consumed unpaid goods, technical disputes and changed financial evidence stay held. Current cancellation evidence is rechecked before separately accepted replacement payment/fulfilment. Every original affected refund needs independent verified settlement and its canonical debit; unknown or changed money remains held. Actual collected and refunded unfulfilled unit positions must cover every original item. Records immutable financial closure, preserves original amounts and handover history, releases only actual active holds, revokes unused pickup codes and closes the remaining obligation. No zero-quantity handover, consumed-stock restocking, payment, fee, credit or broad returns approval. Private operator, reason, hashes and financial proof identities are not buyer output.",
    security: [{ sessionCookie: [] }],
    request: {
      params: orderParamsSchema,
      query: ordersEmptyQuerySchema.removeDefault(),
      headers: z.looseObject({ "x-csrf-token": z.string().min(32) }),
      body: {
        required: true,
        content: { "application/json": { schema: supplyClosureSchema } },
      },
    },
    responses: {
      200: {
        description: "Actual immutable closure and safe supply history",
        content: { "application/json": { schema: response } },
      },
    },
  });
  registry.registerPath({
    method: "post",
    path: "/staff/orders/{orderId}/supply-exceptions/resolve",
    summary: "Record actual verified original supply refund and physical disposition",
    description:
      "Current administrator MFA, CSRF, exact version and UUID replay. Requires the actual current customer remedy, successful independent refund and canonical ledger for the exact original affected allocation. Derives unfulfilled and previously handed-over units from immutable physical history. Refuses active pickup reviews and missing historical handover. Retains audit evidence; does not return stock, invent collection, approve a refund or enable purchasing. Saved settlement must be revalidated before future fulfilment clearance.",
    security: [{ sessionCookie: [] }],
    request: {
      params: orderParamsSchema,
      query: ordersEmptyQuerySchema.removeDefault(),
      headers: z.looseObject({ "x-csrf-token": z.string().min(32) }),
      body: {
        required: true,
        content: { "application/json": { schema: supplyResolutionSchema } },
      },
    },
    responses: {
      200: {
        description: "Immutable actual resolution and safe supply history",
        content: { "application/json": { schema: response } },
      },
    },
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
    if (!staff)
      registry.registerPath({
        method: "post",
        path: `${prefix}/{orderId}/supply-exceptions/choice`,
        summary:
          "Record the actual customer's remedy preference without approving money or a substitute",
        description:
          "Current owned account/guest session, CSRF and exact order version are independently rechecked under locks. Immutable history and UUID replay; changed choices retain earlier entries. Refund review is not refund approval or money returned. Asking for an alternative is not accepting a product, price, credit or new payment. Used/installed/disputed goods require technical assessment. Existing Care recipients are alerted; collection/payment holds remain. No general return policy or new financial permission is approved.",
        security: [guest ? { purchaseGuestCookie: [] } : { sessionCookie: [] }],
        request: {
          params: orderParamsSchema,
          query: ordersEmptyQuerySchema.removeDefault(),
          headers: z.looseObject({ "x-csrf-token": z.string().min(32) }),
          body: {
            required: true,
            content: { "application/json": { schema: supplyRemedyChoiceSchema } },
          },
        },
        responses: {
          200: {
            description:
              "Current customer's immutable preference and safe history; no money moved",
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
