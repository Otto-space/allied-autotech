import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/database.js";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireStaff, requireAdministrator } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import { WorkforceAccessService } from "./workforce-access.service.js";
import { WorkforceWorkService } from "./workforce-work.service.js";
import * as schemas from "./workforce.schemas.js";

import { TeamAccessService } from "./team-access.service.js";
import { privilegedInvitationBodySchema } from "./organization.schemas.js";

const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const empty = z.strictObject({});
// Route definitions are shared with OpenAPI, so every new contract is documented.
export const workforceRouteDefinitions = [
  [
    "get",
    "/staff/workforce/jobs/:id/assignees",
    "jobAssignees",
    empty,
    schemas.workforceRecordParams,
  ],
  [
    "get",
    "/staff/workforce/enquiries/:id/assignees",
    "enquiryAssignees",
    empty,
    schemas.workforceRecordParams,
  ],
  [
    "post",
    "/staff/workforce/complaints/:id/replies",
    "complaintReply",
    schemas.workforceReplySchema,
    schemas.workforceRecordParams,
  ],
  [
    "patch",
    "/staff/workforce/enquiries/:id/assignment",
    "enquiryAssignment",
    schemas.workforceEnquiryAssignmentSchema,
    schemas.workforceRecordParams,
  ],
  [
    "post",
    "/admin/workforce/invitations",
    "inviteAdmin",
    privilegedInvitationBodySchema,
    empty,
  ],
  ["get", "/staff/workforce/access", "own", empty, empty],
  ["get", "/staff/workforce/overview", "overview", empty, empty],
  ["get", "/staff/workforce/jobs", "jobs", schemas.workforceListSchema, empty],
  ["get", "/staff/workforce/bookings", "bookings", schemas.workforceListSchema, empty],
  ["get", "/staff/workforce/jobs/:id", "job", empty, schemas.workforceRecordParams],
  [
    "patch",
    "/staff/workforce/jobs/:id/work",
    "work",
    schemas.workforceWorkSchema,
    schemas.workforceRecordParams,
  ],
  [
    "post",
    "/staff/workforce/jobs/:id/quality",
    "quality",
    schemas.workforceQualitySchema,
    schemas.workforceRecordParams,
  ],
  [
    "patch",
    "/staff/workforce/jobs/:id/assignment",
    "jobAssignment",
    schemas.workforceJobAssignmentSchema,
    schemas.workforceRecordParams,
  ],
  ["get", "/staff/workforce/enquiries", "enquiries", schemas.workforceListSchema, empty],
  [
    "post",
    "/staff/workforce/enquiries/:id/replies",
    "reply",
    schemas.workforceReplySchema,
    schemas.workforceRecordParams,
  ],
  [
    "get",
    "/staff/workforce/complaints",
    "complaints",
    schemas.workforceListSchema,
    empty,
  ],
  ["get", "/staff/workforce/orders", "orders", schemas.workforceListSchema, empty],
  [
    "patch",
    "/staff/workforce/orders/:id",
    "prepare",
    schemas.workforceOrderSchema,
    schemas.workforceRecordParams,
  ],
  ["get", "/staff/workforce/finance", "finance", schemas.workforceListSchema, empty],
  [
    "get",
    "/admin/workforce/accounts/:userId",
    "inspect",
    empty,
    schemas.workforceAccountParams,
  ],
  [
    "put",
    "/admin/workforce/accounts/:userId",
    "enroll",
    schemas.workforceEnrollmentSchema,
    schemas.workforceAccountParams,
  ],
  [
    "post",
    "/admin/workforce/accounts/:userId/assignments",
    "assign",
    schemas.workforceAssignmentSchema,
    schemas.workforceAccountParams,
  ],
  [
    "post",
    "/admin/workforce/accounts/:userId/assignments/:assignmentId/revoke",
    "revoke",
    schemas.workforceRevocationSchema,
    schemas.workforceAssignmentParams,
  ],
  [
    "put",
    "/admin/workforce/accounts/:userId/delegation",
    "delegate",
    schemas.workforceDelegationSchema,
    schemas.workforceAccountParams,
  ],
] as const;

export function createWorkforceRouter(): Router {
  const router = Router(),
    access = new WorkforceAccessService(),
    work = new WorkforceWorkService();
  for (const [method, path, action, schema, params] of workforceRouteDefinitions) {
    const handler = async (req: Request, res: Response) => {
      if (path.startsWith("/admin/workforce/accounts/"))
        res.set("Cache-Control", "private, no-store");
      const actor = req.actor!,
        ctx = context(req),
        body = req.body,
        query = schemas.workforceListSchema.parse(req.query);
      const {
        id = "",
        userId = "",
        assignmentId = "",
      } = req.params as Record<string, string>;
      let data: unknown;
      switch (action) {
        case "jobAssignees":
          data = await work.assignees(actor, id, ctx, "jobs");
          break;
        case "enquiryAssignees":
          data = await work.assignees(actor, id, ctx, "enquiries");
          break;
        case "complaintReply":
          data = await work.complaintReply(
            actor,
            id,
            schemas.workforceReplySchema.parse(body),
            ctx,
          );
          break;
        case "enquiryAssignment":
          data = await work.assignEnquiry(
            actor,
            id,
            schemas.workforceEnquiryAssignmentSchema.parse(body),
            ctx,
          );
          break;
        case "inviteAdmin":
          data = await new TeamAccessService(prisma).invite(
            actor,
            privilegedInvitationBodySchema.parse(body),
            ctx,
          );
          break;
        case "own":
          data = await access.own(actor);
          break;
        case "overview":
          data = await work.overview(actor, ctx);
          break;
        case "jobs":
          data = await work.jobs(actor, query, ctx);
          break;
        case "bookings":
          data = await work.jobs(actor, query, ctx, false);
          break;
        case "job":
          data = await work.job(actor, id, ctx);
          break;
        case "work":
          data = await work.work(actor, id, schemas.workforceWorkSchema.parse(body), ctx);
          break;
        case "quality":
          data = await work.quality(
            actor,
            id,
            schemas.workforceQualitySchema.parse(body),
            ctx,
          );
          break;
        case "jobAssignment":
          data = await work.assign(
            actor,
            id,
            schemas.workforceJobAssignmentSchema.parse(body),
            ctx,
          );
          break;
        case "enquiries":
          data = await work.enquiries(actor, query, ctx);
          break;
        case "reply":
          data = await work.reply(
            actor,
            id,
            schemas.workforceReplySchema.parse(body),
            ctx,
          );
          break;
        case "complaints":
          data = await work.complaints(actor, query, ctx);
          break;
        case "orders":
          data = await work.orders(actor, query, ctx);
          break;
        case "prepare":
          data = await work.prepare(
            actor,
            id,
            schemas.workforceOrderSchema.parse(body),
            ctx,
          );
          break;
        case "finance":
          data = await work.finance(actor, query, ctx);
          break;
        case "inspect":
          data = await access.inspect(actor, userId, ctx);
          break;
        case "enroll":
          data = await access.enroll(
            actor,
            userId,
            schemas.workforceEnrollmentSchema.parse(body),
            ctx,
          );
          break;
        case "assign":
          data = await access.assign(
            actor,
            userId,
            schemas.workforceAssignmentSchema.parse(body),
            ctx,
          );
          break;
        case "revoke":
          data = await access.revoke(
            actor,
            userId,
            assignmentId,
            schemas.workforceRevocationSchema.parse(body),
            ctx,
          );
          break;
        case "delegate":
          data = await access.delegate(
            actor,
            userId,
            schemas.workforceDelegationSchema.parse(body),
            ctx,
          );
          break;
      }
      res.status(200).json(successResponse("Workspace request completed", req.id, data));
    };
    router[method](
      path,
      authenticate(),
      path.startsWith("/admin/") ? requireAdministrator : requireStaff,
      ...(method === "get" ? [] : [requireCsrf, createSensitiveRateLimit(30)]),
      validate({
        params,
        query: method === "get" ? schema : empty,
        ...(method === "get" ? {} : { body: schema }),
      }),
      handler,
    );
  }
  return router;
}
