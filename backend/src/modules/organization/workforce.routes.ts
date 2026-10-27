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
    schemas.workforceJobAssigneesQuerySchema,
    schemas.workforceRecordParams,
  ],
  [
    "get",
    "/staff/workforce/enquiries/:id/assignees",
    "enquiryAssignees",
    schemas.workforceEnquiryAssigneesQuerySchema,
    schemas.workforceRecordParams,
  ],
  [
    "post",
    "/staff/workforce/complaints/:id/replies",
    "complaintReply",
    schemas.workforceComplaintReplySchema,
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
  ["get", "/staff/workforce/jobs", "jobs", schemas.workforceJobsQuerySchema, empty],
  [
    "get",
    "/staff/workforce/bookings",
    "bookings",
    schemas.workforceBookingsQuerySchema,
    empty,
  ],
  ["get", "/staff/workforce/jobs/:id", "job", empty, schemas.workforceRecordParams],
  [
    "get",
    "/staff/workforce/enquiries/:id",
    "enquiry",
    schemas.workforceListSchema,
    schemas.workforceRecordParams,
  ],
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
  [
    "get",
    "/staff/workforce/enquiries",
    "enquiries",
    schemas.workforceEnquiriesQuerySchema,
    empty,
  ],
  [
    "post",
    "/staff/workforce/enquiries/:id/replies",
    "reply",
    schemas.workforceEnquiryReplySchema,
    schemas.workforceRecordParams,
  ],
  [
    "get",
    "/staff/workforce/complaints",
    "complaints",
    schemas.workforceComplaintsQuerySchema,
    empty,
  ],
  [
    "get",
    "/staff/workforce/complaints/:id",
    "complaint",
    schemas.workforceListSchema,
    schemas.workforceRecordParams,
  ],
  ["get", "/staff/workforce/orders", "orders", schemas.workforceOrdersQuerySchema, empty],
  ["get", "/staff/workforce/orders/:id", "order", empty, schemas.workforceRecordParams],
  [
    "patch",
    "/staff/workforce/orders/:id",
    "prepare",
    schemas.workforceOrderSchema,
    schemas.workforceRecordParams,
  ],
  [
    "get",
    "/staff/workforce/finance",
    "finance",
    schemas.workforceFinanceQuerySchema,
    empty,
  ],
  [
    "get",
    "/staff/workforce/finance/:id",
    "financePayment",
    empty,
    schemas.workforceRecordParams,
  ],
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
        query =
          action === "jobs"
            ? schemas.workforceJobsQuerySchema.parse(req.query)
            : [
                  "jobAssignees",
                  "enquiryAssignees",
                  "bookings",
                  "enquiries",
                  "complaints",
                  "orders",
                  "finance",
                ].includes(action)
              ? schemas.workforceListSchema.parse({})
              : schemas.workforceListSchema.parse(req.query);
      const {
        id = "",
        userId = "",
        assignmentId = "",
      } = req.params as Record<string, string>;
      let data: unknown;
      switch (action) {
        case "jobAssignees":
          data = await work.assignees(
            actor,
            id,
            ctx,
            "jobs",
            schemas.workforceJobAssigneesQuerySchema.parse(req.query),
          );
          break;
        case "enquiryAssignees":
          data = await work.assignees(
            actor,
            id,
            ctx,
            "enquiries",
            schemas.workforceEnquiryAssigneesQuerySchema.parse(req.query),
          );
          break;
        case "complaintReply":
          data = await work.complaintReply(
            actor,
            id,
            schemas.workforceComplaintReplySchema.parse(body),
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
          data = await work.bookings(
            actor,
            schemas.workforceBookingsQuerySchema.parse(req.query),
            ctx,
          );
          break;
        case "enquiry":
          data = await work.enquiry(actor, id, query, ctx);
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
          data = await work.enquiries(
            actor,
            schemas.workforceEnquiriesQuerySchema.parse(req.query),
            ctx,
          );
          break;
        case "reply":
          data = await work.reply(
            actor,
            id,
            schemas.workforceEnquiryReplySchema.parse(body),
            ctx,
          );
          break;
        case "complaints":
          data = await work.complaints(
            actor,
            schemas.workforceComplaintsQuerySchema.parse(req.query),
            ctx,
          );
          break;
        case "complaint":
          data = await work.complaint(actor, id, query, ctx);
          break;
        case "orders":
          data = await work.orders(
            actor,
            schemas.workforceOrdersQuerySchema.parse(req.query),
            ctx,
          );
          break;
        case "order":
          data = await work.order(actor, id, ctx);
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
          data = await work.finance(
            actor,
            schemas.workforceFinanceQuerySchema.parse(req.query),
            ctx,
          );
          break;
        case "financePayment":
          data = await work.financePayment(actor, id, ctx);
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
