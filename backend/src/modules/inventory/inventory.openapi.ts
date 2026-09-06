import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  inventoryCreateBodySchema,
  inventoryHistoryQuerySchema,
  inventoryListQuerySchema,
  inventoryMovementBodySchema,
  inventoryParamsSchema,
  inventoryReleaseBodySchema,
  inventoryReservationBodySchema,
  inventoryReservationListQuerySchema,
  inventoryReservationParamsSchema,
  inventoryUpdateBodySchema,
} from "./inventory.schemas.js";

const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrfHeaders = z.object({ "x-csrf-token": z.string().min(32) });
const idempotentHeaders = z.object({
  "x-csrf-token": z.string().min(32),
  "idempotency-key": z.string().min(8).max(120),
});
type RegisterPathInput = Parameters<OpenAPIRegistry["registerPath"]>[0];
type RouteParameter = NonNullable<NonNullable<RegisterPathInput["request"]>["params"]>;
interface Path {
  method: "get" | "post" | "patch";
  path: string;
  summary: string;
  status?: "200" | "201";
  body?: ZodType;
  params?: RouteParameter;
  query?: RouteParameter;
  csrf?: boolean;
  idempotent?: boolean;
}

export function registerInventoryOpenApi(registry: OpenAPIRegistry): void {
  const paths: readonly Path[] = [
    {
      method: "get",
      path: "/staff/inventory",
      summary: "List authorized branch inventory",
      query: inventoryListQuerySchema,
    },
    {
      method: "get",
      path: "/staff/inventory/{inventoryId}",
      summary: "Get authorized inventory",
      params: inventoryParamsSchema,
    },
    {
      method: "patch",
      path: "/staff/inventory/{inventoryId}",
      summary: "Update reorder level",
      params: inventoryParamsSchema,
      body: inventoryUpdateBodySchema,
      csrf: true,
    },
    {
      method: "post",
      path: "/staff/inventory/{inventoryId}/movements",
      summary: "Record an idempotent stock movement",
      params: inventoryParamsSchema,
      body: inventoryMovementBodySchema,
      idempotent: true,
    },
    {
      method: "get",
      path: "/staff/inventory/{inventoryId}/history",
      summary: "List append-only stock history",
      params: inventoryParamsSchema,
      query: inventoryHistoryQuerySchema,
    },
    {
      method: "get",
      path: "/staff/inventory/{inventoryId}/reservations",
      summary: "List inventory reservations",
      params: inventoryParamsSchema,
      query: inventoryReservationListQuerySchema,
    },
    {
      method: "post",
      path: "/staff/inventory/{inventoryId}/reservations",
      summary: "Create an idempotent reservation",
      status: "201",
      params: inventoryParamsSchema,
      body: inventoryReservationBodySchema,
      idempotent: true,
    },
    {
      method: "post",
      path: "/staff/inventory/{inventoryId}/reservations/{reservationId}/release",
      summary: "Release an idempotent reservation",
      params: inventoryReservationParamsSchema,
      body: inventoryReleaseBodySchema,
      idempotent: true,
    },
    {
      method: "post",
      path: "/admin/inventory",
      summary: "Create a branch inventory record",
      status: "201",
      body: inventoryCreateBodySchema,
      csrf: true,
    },
  ];
  for (const path of paths)
    registry.registerPath({
      method: path.method,
      path: path.path,
      tags: ["Inventory"],
      summary: path.summary,
      security: [{ sessionCookie: [] }],
      request: {
        ...(path.params === undefined ? {} : { params: path.params }),
        ...(path.query === undefined ? {} : { query: path.query }),
        ...(path.idempotent === true
          ? { headers: idempotentHeaders }
          : path.csrf === true
            ? { headers: csrfHeaders }
            : {}),
        ...(path.body === undefined
          ? {}
          : {
              body: {
                required: true,
                content: { "application/json": { schema: path.body } },
              },
            }),
      },
      responses: {
        [path.status ?? "200"]: {
          description: "Request completed",
          content: { "application/json": { schema: responseSchema } },
        },
      },
    });
}
