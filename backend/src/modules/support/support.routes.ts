import { z } from "zod";
import { supportService } from "./support.service.js";
import { successResponse } from "../../common/http/api-response.js";
import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireAdministrator,
  requireCustomer,
  requireStaff,
} from "../../common/middleware/authorize.js";
import { requireCsrf, requireTrustedOrigin } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { SupportController } from "./support.controller.js";
import {
  assignmentBodySchema,
  complaintPriorityBodySchema,
  complaintTransitionBodySchema,
  customerComplaintCreateBodySchema,
  customerComplaintListQuerySchema,
  customerEnquiryCreateBodySchema,
  customerEnquiryListQuerySchema,
  customerReviewListQuerySchema,
  enquiryTransitionBodySchema,
  publicComplaintCreateBodySchema,
  publicEnquiryCreateBodySchema,
  publicReviewListQuerySchema,
  reviewCreateBodySchema,
  reviewIdParamsSchema,
  reviewModerationBodySchema,
  staffComplaintListQuerySchema,
  staffEnquiryListQuerySchema,
  staffReviewListQuerySchema,
  staffSupportMessageBodySchema,
  supportEmptyQuerySchema,
  supportIdParamsSchema,
  supportMessageBodySchema,
  supportMessageListQuerySchema,
} from "./support.schemas.js";

export function createPublicSupportRouter(): Router {
  const router = Router();
  const controller = new SupportController();
  router.get(
    "/reviews",
    validate({ query: publicReviewListQuerySchema }),
    controller.publicReviews,
  );
  router.post(
    "/enquiries",
    requireTrustedOrigin,
    createSensitiveRateLimit(8, 60 * 60_000),
    validate({ body: publicEnquiryCreateBodySchema, query: supportEmptyQuerySchema }),
    controller.publicEnquiry,
  );
  router.post(
    "/complaints",
    requireTrustedOrigin,
    createSensitiveRateLimit(5, 60 * 60_000),
    validate({ body: publicComplaintCreateBodySchema, query: supportEmptyQuerySchema }),
    controller.publicComplaint,
  );
  return router;
}

export function createCustomerSupportRouter(): Router {
  const router = Router();
  const controller = new SupportController();
  router.use(authenticate(), requireCustomer);
  router.get(
    "/enquiries",
    validate({ query: customerEnquiryListQuerySchema }),
    controller.listEnquiries,
  );
  router.post(
    "/enquiries",
    requireCsrf,
    createSensitiveRateLimit(20, 60 * 60_000),
    validate({ body: customerEnquiryCreateBodySchema, query: supportEmptyQuerySchema }),
    controller.createEnquiry,
  );
  router.get(
    "/enquiries/:supportId",
    validate({ params: supportIdParamsSchema, query: supportEmptyQuerySchema }),
    controller.getEnquiry,
  );
  router.post(
    "/enquiries/:supportId/messages",
    requireCsrf,
    createSensitiveRateLimit(30, 60 * 60_000),
    validate({
      params: supportIdParamsSchema,
      body: supportMessageBodySchema,
      query: supportEmptyQuerySchema,
    }),
    controller.messageEnquiry,
  );
  router.get(
    "/enquiries/:supportId/messages",
    validate({ params: supportIdParamsSchema, query: supportMessageListQuerySchema }),
    controller.enquiryMessages,
  );
  router.get(
    "/complaints",
    validate({ query: customerComplaintListQuerySchema }),
    controller.listComplaints,
  );
  router.post(
    "/complaints",
    requireCsrf,
    createSensitiveRateLimit(10, 60 * 60_000),
    validate({ body: customerComplaintCreateBodySchema, query: supportEmptyQuerySchema }),
    controller.createComplaint,
  );
  router.get(
    "/complaints/:supportId",
    validate({ params: supportIdParamsSchema, query: supportEmptyQuerySchema }),
    controller.getComplaint,
  );
  router.post(
    "/complaints/:supportId/messages",
    requireCsrf,
    createSensitiveRateLimit(30, 60 * 60_000),
    validate({
      params: supportIdParamsSchema,
      body: supportMessageBodySchema,
      query: supportEmptyQuerySchema,
    }),
    controller.messageComplaint,
  );
  router.get(
    "/complaints/:supportId/messages",
    validate({ params: supportIdParamsSchema, query: supportMessageListQuerySchema }),
    controller.complaintMessages,
  );
  router.get(
    "/reviews",
    validate({ query: customerReviewListQuerySchema }),
    controller.listReviews,
  );
  router.post(
    "/reviews",
    requireCsrf,
    createSensitiveRateLimit(10, 60 * 60_000),
    validate({ body: reviewCreateBodySchema, query: supportEmptyQuerySchema }),
    controller.createReview,
  );
  return router;
}

export function createStaffSupportRouter(): Router {
  const router = Router();
  const controller = new SupportController();
  router.use(authenticate(), requireStaff);
  router.get(
    "/enquiries",
    validate({ query: staffEnquiryListQuerySchema }),
    controller.staffEnquiries,
  );
  router.get(
    "/enquiries/:supportId",
    validate({ params: supportIdParamsSchema, query: supportEmptyQuerySchema }),
    controller.staffGetEnquiry,
  );
  router.post(
    "/enquiries/:supportId/assignment",
    requireCsrf,
    validate({
      params: supportIdParamsSchema,
      body: assignmentBodySchema,
      query: supportEmptyQuerySchema,
    }),
    controller.assignEnquiry,
  );
  router.post(
    "/enquiries/:supportId/status",
    requireCsrf,
    validate({
      params: supportIdParamsSchema,
      body: enquiryTransitionBodySchema,
      query: supportEmptyQuerySchema,
    }),
    controller.transitionEnquiry,
  );
  router.post(
    "/enquiries/:supportId/messages",
    requireCsrf,
    validate({
      params: supportIdParamsSchema,
      body: staffSupportMessageBodySchema,
      query: supportEmptyQuerySchema,
    }),
    controller.staffMessageEnquiry,
  );
  router.get(
    "/enquiries/:supportId/messages",
    validate({ params: supportIdParamsSchema, query: supportMessageListQuerySchema }),
    controller.staffEnquiryMessages,
  );
  router.get(
    "/complaints",
    validate({ query: staffComplaintListQuerySchema }),
    controller.staffComplaints,
  );
  router.get(
    "/complaints/:supportId",
    validate({ params: supportIdParamsSchema, query: supportEmptyQuerySchema }),
    controller.staffGetComplaint,
  );
  router.post(
    "/complaints/:supportId/assignment",
    requireCsrf,
    validate({
      params: supportIdParamsSchema,
      body: assignmentBodySchema,
      query: supportEmptyQuerySchema,
    }),
    controller.assignComplaint,
  );
  router.post(
    "/complaints/:supportId/status",
    requireCsrf,
    validate({
      params: supportIdParamsSchema,
      body: complaintTransitionBodySchema,
      query: supportEmptyQuerySchema,
    }),
    controller.transitionComplaint,
  );
  router.post(
    "/complaints/:supportId/priority",
    requireCsrf,
    validate({
      params: supportIdParamsSchema,
      body: complaintPriorityBodySchema,
      query: supportEmptyQuerySchema,
    }),
    controller.priorityComplaint,
  );
  router.post(
    "/complaints/:supportId/messages",
    requireCsrf,
    validate({
      params: supportIdParamsSchema,
      body: staffSupportMessageBodySchema,
      query: supportEmptyQuerySchema,
    }),
    controller.staffMessageComplaint,
  );
  router.get(
    "/complaints/:supportId/messages",
    validate({ params: supportIdParamsSchema, query: supportMessageListQuerySchema }),
    controller.staffComplaintMessages,
  );
  router.get(
    "/reviews",
    requireAdministrator,
    validate({ query: staffReviewListQuerySchema }),
    controller.staffReviews,
  );
  router.post(
    "/reviews/:reviewId/moderation",
    requireAdministrator,
    requireCsrf,
    validate({
      params: reviewIdParamsSchema,
      body: reviewModerationBodySchema,
      query: supportEmptyQuerySchema,
    }),
    controller.moderateReview,
  );
  router.post(
    "/complaints/:supportId/acknowledge",
    requireCsrf,
    validate({
      params: supportIdParamsSchema,
      body: z.object({ message: z.string().trim().min(10).max(2000) }).strict(),
    }),
    async (req, res) => {
      const id = (res.locals.validated!["params"] as { supportId: string }).supportId;
      const input = res.locals.validated!["body"] as { message: string };
      res.json(
        successResponse(
          "Complaint acknowledged",
          req.id,
          await supportService.acknowledgeComplaint(req.actor!, id, input.message, {
            requestId: String(req.id),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          }),
        ),
      );
    },
  );
  return router;
}
