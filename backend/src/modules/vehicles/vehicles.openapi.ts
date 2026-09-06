import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  assetUploadBodySchema,
  conditionReportBodySchema,
  documentCreateBodySchema,
  documentParamsSchema,
  documentReviewBodySchema,
  imageCreateBodySchema,
  imageParamsSchema,
  listingCreateBodySchema,
  listingParamsSchema,
  listingPriceBodySchema,
  listingStatusBodySchema,
  listingUpdateBodySchema,
  publicVehicleListQuerySchema,
  staffVehicleListQuerySchema,
  vehicleCreateBodySchema,
  vehicleParamsSchema,
  vehicleUpdateBodySchema,
} from "./vehicles.schemas.js";
const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrf = z.object({ "x-csrf-token": z.string().min(32) });
type Path = {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  summary: string;
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
  secured?: boolean;
  mutation?: boolean;
  created?: boolean;
  redirect?: boolean;
};
export function registerVehiclesOpenApi(registry: OpenAPIRegistry): void {
  const paths: Path[] = [
    {
      method: "get",
      path: "/public/vehicles",
      summary: "Search published vehicle listings",
      query: publicVehicleListQuerySchema,
    },
    {
      method: "get",
      path: "/public/vehicles/{listingId}",
      summary: "Get a published vehicle listing",
      params: listingParamsSchema,
    },
    {
      method: "get",
      path: "/public/vehicles/images/{imageId}",
      summary: "Resolve short-lived public listing image access",
      params: imageParamsSchema,
      redirect: true,
    },
    {
      method: "get",
      path: "/customers/saved-vehicles",
      summary: "List saved vehicles",
      secured: true,
    },
    {
      method: "put",
      path: "/customers/saved-vehicles/{listingId}",
      summary: "Save a vehicle",
      params: listingParamsSchema,
      secured: true,
      mutation: true,
    },
    {
      method: "delete",
      path: "/customers/saved-vehicles/{listingId}",
      summary: "Remove a saved vehicle",
      params: listingParamsSchema,
      secured: true,
      mutation: true,
    },
    {
      method: "get",
      path: "/staff/vehicles",
      summary: "List branch vehicle inventory",
      query: staffVehicleListQuerySchema,
      secured: true,
    },
    {
      method: "post",
      path: "/staff/vehicles",
      summary: "Create a physical vehicle",
      body: vehicleCreateBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "get",
      path: "/staff/vehicles/{vehicleId}",
      summary: "Get vehicle inventory details",
      params: vehicleParamsSchema,
      secured: true,
    },
    {
      method: "patch",
      path: "/staff/vehicles/{vehicleId}",
      summary: "Update vehicle inventory",
      params: vehicleParamsSchema,
      body: vehicleUpdateBodySchema,
      secured: true,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/listings",
      summary: "Create a vehicle listing",
      body: listingCreateBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "patch",
      path: "/staff/vehicles/listings/{listingId}",
      summary: "Update a vehicle listing",
      params: listingParamsSchema,
      body: listingUpdateBodySchema,
      secured: true,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/listings/{listingId}/status",
      summary: "Transition a vehicle listing",
      params: listingParamsSchema,
      body: listingStatusBodySchema,
      secured: true,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/listings/{listingId}/price",
      summary: "Change listing price with history",
      params: listingParamsSchema,
      body: listingPriceBodySchema,
      secured: true,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/assets/upload",
      summary: "Authorize a bounded object upload",
      params: vehicleParamsSchema,
      body: assetUploadBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/images",
      summary: "Confirm uploaded vehicle image",
      params: vehicleParamsSchema,
      body: imageCreateBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/documents",
      summary: "Confirm uploaded private document",
      params: vehicleParamsSchema,
      body: documentCreateBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/condition-reports",
      summary: "Create a condition report",
      params: vehicleParamsSchema,
      body: conditionReportBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/documents/{documentId}/review",
      summary: "Review a vehicle document",
      params: documentParamsSchema,
      body: documentReviewBodySchema,
      secured: true,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/documents/{documentId}/access",
      summary: "Authorize private document download",
      params: documentParamsSchema,
      secured: true,
      mutation: true,
    },
  ];
  for (const route of paths)
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Vehicles"],
      summary: route.summary,
      ...(route.secured ? { security: [{ sessionCookie: [] }] } : {}),
      request: {
        ...(route.params ? { params: route.params as never } : {}),
        ...(route.query ? { query: route.query as never } : {}),
        ...(route.mutation ? { headers: csrf } : {}),
        ...(route.body
          ? {
              body: {
                required: true,
                content: { "application/json": { schema: route.body } },
              },
            }
          : {}),
      },
      responses: route.redirect
        ? { "302": { description: "Redirect to a short-lived signed image URL" } }
        : {
            [route.created ? "201" : "200"]: {
              description: "Request completed",
              content: { "application/json": { schema: responseSchema } },
            },
          },
    });
}
