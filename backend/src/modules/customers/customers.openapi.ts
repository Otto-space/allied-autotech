import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";

import {
  customerProfileUpdateBodySchema,
  customerVehicleCreateBodySchema,
  customerVehicleListQuerySchema,
  customerVehicleParamsSchema,
  customerVehicleUpdateBodySchema,
} from "./customers.schemas.js";

const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrfHeaders = z.object({ "x-csrf-token": z.string().min(32) });
type RegisterPathInput = Parameters<OpenAPIRegistry["registerPath"]>[0];
type RouteParameter = NonNullable<NonNullable<RegisterPathInput["request"]>["params"]>;

interface CustomerPath {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  summary: string;
  status: "200" | "201";
  body?: ZodType;
  params?: RouteParameter;
  query?: RouteParameter;
  csrf?: boolean;
}

export function registerCustomersOpenApi(registry: OpenAPIRegistry): void {
  const paths: readonly CustomerPath[] = [
    {
      method: "get",
      path: "/customers/profile",
      summary: "Get own customer profile",
      status: "200",
    },
    {
      method: "patch",
      path: "/customers/profile",
      summary: "Update own customer profile",
      status: "200",
      body: customerProfileUpdateBodySchema,
      csrf: true,
    },
    {
      method: "get",
      path: "/customers/vehicles",
      summary: "List own customer vehicles",
      status: "200",
      query: customerVehicleListQuerySchema,
    },
    {
      method: "post",
      path: "/customers/vehicles",
      summary: "Create an owned customer vehicle",
      status: "201",
      body: customerVehicleCreateBodySchema,
      csrf: true,
    },
    {
      method: "get",
      path: "/customers/vehicles/{vehicleId}",
      summary: "Get an owned customer vehicle",
      status: "200",
      params: customerVehicleParamsSchema,
    },
    {
      method: "patch",
      path: "/customers/vehicles/{vehicleId}",
      summary: "Update an owned customer vehicle",
      status: "200",
      params: customerVehicleParamsSchema,
      body: customerVehicleUpdateBodySchema,
      csrf: true,
    },
    {
      method: "delete",
      path: "/customers/vehicles/{vehicleId}",
      summary: "Delete an owned customer vehicle",
      status: "200",
      params: customerVehicleParamsSchema,
      csrf: true,
    },
  ];

  for (const path of paths) {
    registry.registerPath({
      method: path.method,
      path: path.path,
      tags: ["Customers"],
      summary: path.summary,
      security: [{ sessionCookie: [] }],
      request: {
        ...(path.params === undefined ? {} : { params: path.params }),
        ...(path.query === undefined ? {} : { query: path.query }),
        ...(path.csrf === true ? { headers: csrfHeaders } : {}),
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
        [path.status]: {
          description: "Request completed",
          content: { "application/json": { schema: responseSchema } },
        },
      },
    });
  }
}
