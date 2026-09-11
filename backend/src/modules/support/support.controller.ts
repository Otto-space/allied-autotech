import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { successResponse } from "../../common/http/api-response.js";
import type {
  AssignmentInput,
  ComplaintPriorityInput,
  ComplaintTransitionInput,
  CustomerComplaintInput,
  CustomerEnquiryInput,
  CustomerReviewListQuery,
  CustomerSupportListQuery,
  EnquiryTransitionInput,
  PublicComplaintInput,
  PublicEnquiryInput,
  PublicReviewListQuery,
  ReviewCreateInput,
  ReviewModerationInput,
  StaffComplaintListQuery,
  StaffEnquiryListQuery,
  StaffReviewListQuery,
  StaffSupportMessageInput,
  SupportMessageInput,
  SupportMessageListQuery,
} from "./support.schemas.js";
import { supportService, type SupportService } from "./support.service.js";

const validated = <T>(response: Response, location: "body" | "params" | "query") =>
  response.locals.validated?.[location] as T;
const actor = (request: Request) => request.actor as AuthenticatedActor;
const context = (request: Request): RequestSecurityContext => ({
  requestId: String(request.id),
  ipAddress: request.ip ?? null,
  userAgent: request.get("user-agent") ?? null,
});
const id = (response: Response) =>
  validated<{ supportId: string }>(response, "params").supportId;

export class SupportController {
  constructor(private readonly service: SupportService = supportService) {}

  publicEnquiry = async (req: Request, res: Response) =>
    res
      .status(202)
      .json(
        successResponse(
          "Enquiry accepted",
          req.id,
          await this.service.createPublicEnquiry(
            validated<PublicEnquiryInput>(res, "body"),
            context(req),
          ),
        ),
      );
  publicComplaint = async (req: Request, res: Response) =>
    res
      .status(202)
      .json(
        successResponse(
          "Complaint accepted",
          req.id,
          await this.service.createPublicComplaint(
            validated<PublicComplaintInput>(res, "body"),
            context(req),
          ),
        ),
      );
  publicReviews = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Reviews retrieved",
          req.id,
          await this.service.publicReviews(
            validated<PublicReviewListQuery>(res, "query"),
          ),
        ),
      );
  createEnquiry = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Enquiry created",
          req.id,
          await this.service.createCustomerEnquiry(
            actor(req),
            validated<CustomerEnquiryInput>(res, "body"),
            context(req),
          ),
        ),
      );
  listEnquiries = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Enquiries retrieved",
          req.id,
          await this.service.customerEnquiries(
            actor(req),
            validated<CustomerSupportListQuery>(res, "query"),
          ),
        ),
      );
  getEnquiry = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Enquiry retrieved",
          req.id,
          await this.service.customerEnquiry(actor(req), id(res)),
        ),
      );
  enquiryMessages = async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    return res
      .status(200)
      .json(
        successResponse(
          "Messages retrieved",
          req.id,
          await this.service.customerMessages(
            actor(req),
            "enquiry",
            id(res),
            validated<SupportMessageListQuery>(res, "query"),
          ),
        ),
      );
  };
  messageEnquiry = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Message added",
          req.id,
          await this.service.addCustomerMessage(
            actor(req),
            "enquiry",
            id(res),
            validated<SupportMessageInput>(res, "body"),
            context(req),
          ),
        ),
      );
  createComplaint = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Complaint created",
          req.id,
          await this.service.createCustomerComplaint(
            actor(req),
            validated<CustomerComplaintInput>(res, "body"),
            context(req),
          ),
        ),
      );
  listComplaints = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Complaints retrieved",
          req.id,
          await this.service.customerComplaints(
            actor(req),
            validated<CustomerSupportListQuery>(res, "query"),
          ),
        ),
      );
  getComplaint = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Complaint retrieved",
          req.id,
          await this.service.customerComplaint(actor(req), id(res)),
        ),
      );
  complaintMessages = async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    return res
      .status(200)
      .json(
        successResponse(
          "Messages retrieved",
          req.id,
          await this.service.customerMessages(
            actor(req),
            "complaint",
            id(res),
            validated<SupportMessageListQuery>(res, "query"),
          ),
        ),
      );
  };
  messageComplaint = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Message added",
          req.id,
          await this.service.addCustomerMessage(
            actor(req),
            "complaint",
            id(res),
            validated<SupportMessageInput>(res, "body"),
            context(req),
          ),
        ),
      );
  createReview = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Review submitted for moderation",
          req.id,
          await this.service.createReview(
            actor(req),
            validated<ReviewCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  listReviews = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Reviews retrieved",
          req.id,
          await this.service.customerReviews(
            actor(req),
            validated<CustomerReviewListQuery>(res, "query"),
          ),
        ),
      );
  staffEnquiries = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Enquiries retrieved",
          req.id,
          await this.service.staffEnquiries(
            actor(req),
            validated<StaffEnquiryListQuery>(res, "query"),
            context(req),
          ),
        ),
      );
  staffComplaints = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Complaints retrieved",
          req.id,
          await this.service.staffComplaints(
            actor(req),
            validated<StaffComplaintListQuery>(res, "query"),
            context(req),
          ),
        ),
      );
  staffReviews = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Reviews retrieved",
          req.id,
          await this.service.staffReviews(
            actor(req),
            validated<StaffReviewListQuery>(res, "query"),
            context(req),
          ),
        ),
      );
  staffGetEnquiry = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Enquiry retrieved",
          req.id,
          await this.service.staffRecord(actor(req), "enquiry", id(res), context(req)),
        ),
      );
  staffGetComplaint = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Complaint retrieved",
          req.id,
          await this.service.staffRecord(actor(req), "complaint", id(res), context(req)),
        ),
      );
  staffEnquiryMessages = async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    return res
      .status(200)
      .json(
        successResponse(
          "Messages retrieved",
          req.id,
          await this.service.staffMessages(
            actor(req),
            "enquiry",
            id(res),
            validated<SupportMessageListQuery>(res, "query"),
          ),
        ),
      );
  };
  staffComplaintMessages = async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    return res
      .status(200)
      .json(
        successResponse(
          "Messages retrieved",
          req.id,
          await this.service.staffMessages(
            actor(req),
            "complaint",
            id(res),
            validated<SupportMessageListQuery>(res, "query"),
          ),
        ),
      );
  };
  assignEnquiry = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Enquiry assignment updated",
          req.id,
          await this.service.assign(
            actor(req),
            "enquiry",
            id(res),
            validated<AssignmentInput>(res, "body"),
            context(req),
          ),
        ),
      );
  assignComplaint = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Complaint assignment updated",
          req.id,
          await this.service.assign(
            actor(req),
            "complaint",
            id(res),
            validated<AssignmentInput>(res, "body"),
            context(req),
          ),
        ),
      );
  transitionEnquiry = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Enquiry status updated",
          req.id,
          await this.service.transitionEnquiry(
            actor(req),
            id(res),
            validated<EnquiryTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  transitionComplaint = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Complaint status updated",
          req.id,
          await this.service.transitionComplaint(
            actor(req),
            id(res),
            validated<ComplaintTransitionInput>(res, "body"),
            context(req),
          ),
        ),
      );
  priorityComplaint = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Complaint priority updated",
          req.id,
          await this.service.setComplaintPriority(
            actor(req),
            id(res),
            validated<ComplaintPriorityInput>(res, "body"),
            context(req),
          ),
        ),
      );
  staffMessageEnquiry = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Message added",
          req.id,
          await this.service.addStaffMessage(
            actor(req),
            "enquiry",
            id(res),
            validated<StaffSupportMessageInput>(res, "body"),
            context(req),
          ),
        ),
      );
  staffMessageComplaint = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Message added",
          req.id,
          await this.service.addStaffMessage(
            actor(req),
            "complaint",
            id(res),
            validated<StaffSupportMessageInput>(res, "body"),
            context(req),
          ),
        ),
      );
  moderateReview = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Review moderation recorded",
          req.id,
          await this.service.moderateReview(
            actor(req),
            validated<{ reviewId: string }>(res, "params").reviewId,
            validated<ReviewModerationInput>(res, "body"),
            context(req),
          ),
        ),
      );
}
