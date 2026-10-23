import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import { mediaImageSchema } from "../media/media.schemas.js";

const profileResponse = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  phoneVerifiedAt: z.iso.datetime().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  user: z.object({ id: z.uuid(), email: z.string() }),
  mediaVersion: z.number().int(),
  profileVersion: z.number().int().nonnegative(),
  photo: mediaImageSchema.nullable(),
});
const garageVehicleResponse = z.object({
  id: z.uuid(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  registrationNumber: z.string().nullable(),
  vin: z.string().nullable(),
  color: z.string().nullable(),
  mileageKm: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  mediaVersion: z.number().int(),
  images: z.array(mediaImageSchema).max(12),
});
const garageVehiclePageResponse = z.object({
  vehicles: z.array(garageVehicleResponse.omit({ mediaVersion: true })).max(50),
  nextCursor: z.uuid().optional(),
});

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
      ...(path.path === "/customers/profile"
        ? {
            description:
              "Customer owner only. Profile text has its own profileVersion, independent of mediaVersion. PATCH requires expectedVersion from the owned profile read and at least one editable field. The update, revision increment and changed-field audit commit atomically. A stale version returns 409 STALE_VERSION without changes. Missing versions return 422; there is no unversioned update bypass. Changing the phone clears its previous verification. Optional address/city/state accept null. On a lost response, GET and explicitly review saved details before another update; automatic replay is not supported. Deploy the additive profile-version migration and matching backend/frontend together.",
          }
        : {}),
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
          content: {
            "application/json": {
              schema:
                path.path === "/customers/profile"
                  ? responseSchema.extend({ data: profileResponse })
                  : path.path === "/customers/vehicles" && path.method === "get"
                    ? responseSchema.extend({ data: garageVehiclePageResponse })
                    : path.path === "/customers/vehicles/{vehicleId}" &&
                        path.method === "get"
                      ? responseSchema.extend({ data: garageVehicleResponse })
                      : responseSchema,
            },
          },
        },
      },
    });
  }
}
