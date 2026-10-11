import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  customerInspectionListQuerySchema,
  customerTransactionListQuerySchema,
  expireReservationsBodySchema,
  handoverCreateBodySchema,
  handoverParamsSchema,
  handoverTransitionBodySchema,
  inspectionCreateBodySchema,
  inspectionParamsSchema,
  inspectionTransitionBodySchema,
  negotiationBodySchema,
  reservationBodySchema,
  staffInspectionListQuerySchema,
  staffTransactionListQuerySchema,
  transactionCreateBodySchema,
  transactionParamsSchema,
  transactionTransitionBodySchema,
} from "./vehicle-sales.schemas.js";
const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrf = z.object({ "x-csrf-token": z.string().min(32) });
const idempotency = csrf.extend({ "idempotency-key": z.string().min(16).max(200) });
const creationIdempotency = csrf.extend({
  "idempotency-key": z
    .string()
    .trim()
    .min(16)
    .max(200)
    .optional()
    .describe(
      "Optional for compatibility. Use a random key for each new intent and reuse it with the same validated body for retries. Keys are scoped to the authenticated customer and operation and retained for at least 24 hours. A retained matching key returns the original record with its current authorized state (201); changed input returns 409 IDEMPOTENCY_CONFLICT. No retry guarantee after retention or without a key. Check account history before submitting again after expiry.",
    ),
});
type Path = {
  method: "get" | "post";
  path: string;
  summary: string;
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
  mutation?: boolean;
  idempotent?: boolean;
  creationRetry?: boolean;
  created?: boolean;
};
export function registerVehicleSalesOpenApi(registry: OpenAPIRegistry): void {
  const paths: Path[] = [
    {
      method: "get",
      path: "/customers/vehicle-inspections",
      summary: "List own inspection requests",
      query: customerInspectionListQuerySchema,
    },
    {
      method: "post",
      path: "/customers/vehicle-inspections",
      summary: "Request a vehicle inspection",
      body: inspectionCreateBodySchema,
      creationRetry: true,
      mutation: true,
      created: true,
    },
    {
      method: "get",
      path: "/customers/vehicle-transactions",
      summary: "List own vehicle transactions",
      query: customerTransactionListQuerySchema,
    },
    {
      method: "post",
      path: "/customers/vehicle-transactions",
      summary: "Open a vehicle transaction",
      body: transactionCreateBodySchema,
      creationRetry: true,
      mutation: true,
      created: true,
    },
    {
      method: "get",
      path: "/customers/vehicle-transactions/{transactionId}",
      summary: "Get own vehicle transaction",
      params: transactionParamsSchema,
    },
    {
      method: "post",
      path: "/customers/vehicle-transactions/{transactionId}/reserve",
      summary: "Reserve an agreed vehicle",
      params: transactionParamsSchema,
      body: reservationBodySchema,
      mutation: true,
      idempotent: true,
    },
    {
      method: "get",
      path: "/staff/vehicle-inspections",
      summary: "List branch inspections",
      query: staffInspectionListQuerySchema,
    },
    {
      method: "post",
      path: "/staff/vehicle-inspections/{inspectionId}/status",
      summary: "Transition an inspection",
      params: inspectionParamsSchema,
      body: inspectionTransitionBodySchema,
      mutation: true,
    },
    {
      method: "get",
      path: "/staff/vehicle-transactions",
      summary: "List branch vehicle transactions",
      query: staffTransactionListQuerySchema,
    },
    {
      method: "get",
      path: "/staff/vehicle-transactions/{transactionId}",
      summary: "Get a branch vehicle transaction",
      params: transactionParamsSchema,
    },
    {
      method: "post",
      path: "/staff/vehicle-transactions/{transactionId}/negotiate",
      summary: "Record an agreed vehicle price",
      params: transactionParamsSchema,
      body: negotiationBodySchema,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicle-transactions/{transactionId}/status",
      summary: "Transition a vehicle transaction",
      params: transactionParamsSchema,
      body: transactionTransitionBodySchema,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicle-transactions/{transactionId}/handovers",
      summary: "Create a paid-vehicle handover",
      params: transactionParamsSchema,
      body: handoverCreateBodySchema,
      mutation: true,
      created: true,
    },
    {
      method: "post",
      path: "/staff/vehicle-transactions/{transactionId}/handovers/{handoverId}/status",
      summary: "Transition a vehicle handover",
      params: handoverParamsSchema,
      body: handoverTransitionBodySchema,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicle-transactions/{transactionId}/handovers/{handoverId}/access",
      summary: "Authorize private handover document access",
      params: handoverParamsSchema,
      mutation: true,
    },
    {
      method: "post",
      path: "/admin/vehicle-transactions/expire",
      summary: "Release expired vehicle reservations",
      body: expireReservationsBodySchema,
      mutation: true,
    },
  ];
  for (const route of paths)
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Vehicle Sales"],
      summary: route.summary,
      security: [{ sessionCookie: [] }],
      request: {
        ...(route.params ? { params: route.params as never } : {}),
        ...(route.query ? { query: route.query as never } : {}),
        ...(route.mutation
          ? {
              headers: route.creationRetry
                ? creationIdempotency
                : route.idempotent
                  ? idempotency
                  : csrf,
            }
          : {}),
        ...(route.body
          ? {
              body: {
                required: true,
                content: { "application/json": { schema: route.body } },
              },
            }
          : {}),
      },
      responses: {
        ...(route.creationRetry
          ? {
              "409": {
                description:
                  "IDEMPOTENCY_CONFLICT for changed input or an incomplete retained receipt; CONFLICT for an invalid new request. No new record is created.",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                  },
                },
              },
              "404": {
                description:
                  "The listing, customer profile or owned retry result was not found.",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/ErrorResponse" },
                  },
                },
              },
            }
          : {}),
        [route.created ? "201" : "200"]: {
          description: "Request completed",
          content: { "application/json": { schema: responseSchema } },
        },
      },
    });
}
