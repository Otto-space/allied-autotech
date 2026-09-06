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
type Path = {
  method: "get" | "post";
  path: string;
  summary: string;
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
  mutation?: boolean;
  idempotent?: boolean;
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
        ...(route.mutation ? { headers: route.idempotent ? idempotency : csrf } : {}),
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
        [route.created ? "201" : "200"]: {
          description: "Request completed",
          content: { "application/json": { schema: responseSchema } },
        },
      },
    });
}
