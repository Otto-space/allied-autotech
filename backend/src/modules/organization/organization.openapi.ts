import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";

import { publicApiPaths } from "../../common/contracts/public-api.js";
import {
  adminBranchListQuerySchema,
  branchCreateBodySchema,
  branchParamsSchema,
  branchUpdateBodySchema,
  privilegedInvitationAcceptBodySchema,
  privilegedInvitationBodySchema,
  publicBranchListQuerySchema,
  staffBranchBodySchema,
  staffListQuerySchema,
  staffParamsSchema,
  staffRoleBodySchema,
  staffStatusBodySchema,
} from "./organization.schemas.js";

const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const publicBranchSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.email().nullable(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  timezone: z.string(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
const publicBranchListResponseSchema = responseSchema.extend({
  data: z.object({
    items: z.array(publicBranchSchema),
    nextCursor: z.uuid().optional(),
  }),
});
const publicBranchResponseSchema = responseSchema.extend({ data: publicBranchSchema });
const csrfHeaders = z.object({ "x-csrf-token": z.string().min(32) });
type RegisterPathInput = Parameters<OpenAPIRegistry["registerPath"]>[0];
type RouteParameter = NonNullable<NonNullable<RegisterPathInput["request"]>["params"]>;

interface OrganizationPath {
  method: "get" | "post" | "patch";
  path: string;
  summary: string;
  status?: "200" | "201" | "202";
  body?: ZodType;
  params?: RouteParameter;
  query?: RouteParameter;
  secured?: boolean;
  csrf?: boolean;
  response?: ZodType;
}

export function registerOrganizationOpenApi(registry: OpenAPIRegistry): void {
  const paths: readonly OrganizationPath[] = [
    {
      method: "get",
      path: publicApiPaths.branches,
      summary: "List active public branches",
      query: publicBranchListQuerySchema,
      response: publicBranchListResponseSchema,
    },
    {
      method: "get",
      path: publicApiPaths.branch,
      summary: "Get an active public branch",
      params: branchParamsSchema,
      response: publicBranchResponseSchema,
    },
    {
      method: "get",
      path: "/staff/profile",
      summary: "Get the current privileged profile",
      secured: true,
    },
    {
      method: "get",
      path: "/admin/branches",
      summary: "List branches",
      secured: true,
      query: adminBranchListQuerySchema,
    },
    {
      method: "post",
      path: "/admin/branches",
      summary: "Create a branch",
      status: "201",
      secured: true,
      csrf: true,
      body: branchCreateBodySchema,
    },
    {
      method: "get",
      path: "/admin/branches/{branchId}",
      summary: "Get a branch",
      secured: true,
      params: branchParamsSchema,
    },
    {
      method: "patch",
      path: "/admin/branches/{branchId}",
      summary: "Update a branch",
      secured: true,
      csrf: true,
      params: branchParamsSchema,
      body: branchUpdateBodySchema,
    },
    {
      method: "get",
      path: "/admin/staff",
      summary: "List privileged users",
      secured: true,
      query: staffListQuerySchema,
    },
    {
      method: "get",
      path: "/admin/staff/{staffUserId}",
      summary: "Get a privileged user",
      secured: true,
      params: staffParamsSchema,
    },
    {
      method: "post",
      path: "/admin/staff/invitations",
      summary: "Invite a staff member or administrator",
      status: "202",
      secured: true,
      csrf: true,
      body: privilegedInvitationBodySchema,
    },
    {
      method: "post",
      path: "/auth/staff/invitations/accept",
      summary: "Accept a privileged invitation",
      status: "201",
      body: privilegedInvitationAcceptBodySchema,
    },
    {
      method: "patch",
      path: "/admin/staff/{staffUserId}/status",
      summary: "Change a privileged user status",
      secured: true,
      csrf: true,
      params: staffParamsSchema,
      body: staffStatusBodySchema,
    },
    {
      method: "patch",
      path: "/admin/staff/{staffUserId}/branch",
      summary: "Assign staff to an active branch",
      secured: true,
      csrf: true,
      params: staffParamsSchema,
      body: staffBranchBodySchema,
    },
    {
      method: "patch",
      path: "/admin/staff/{staffUserId}/role",
      summary: "Change a staff or administrator role",
      secured: true,
      csrf: true,
      params: staffParamsSchema,
      body: staffRoleBodySchema,
    },
  ];

  for (const path of paths) {
    const status = path.status ?? "200";
    registry.registerPath({
      method: path.method,
      path: path.path,
      tags: ["Organization"],
      summary: path.summary,
      ...(path.secured === true ? { security: [{ sessionCookie: [] }] } : {}),
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
        [status]: {
          description: "Request completed",
          content: { "application/json": { schema: path.response ?? responseSchema } },
        },
      },
    });
  }
}
