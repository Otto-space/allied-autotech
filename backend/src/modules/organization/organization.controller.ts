import type { Request, Response } from "express";

import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { successResponse } from "../../common/http/api-response.js";
import type { UserStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../config/database.js";
import { TeamAccessService } from "./team-access.service.js";
import type {
  AdminBranchListQuery,
  BranchCreateInput,
  BranchUpdateInput,
  PrivilegedInvitationAcceptInput,
  PrivilegedInvitationInput,
  PublicBranchListQuery,
  StaffListQuery,
  StaffRoleInput,
  StaffPromotionInput,
  InvitationListQuery,
} from "./organization.schemas.js";
import { organizationService, type OrganizationService } from "./organization.service.js";

function validated<T>(response: Response, location: "body" | "params" | "query"): T {
  return response.locals.validated?.[location] as T;
}

function actor(request: Request): AuthenticatedActor {
  if (request.actor === undefined) {
    throw new AppError({
      code: errorCodes.unauthorized,
      message: "Authentication is required",
      statusCode: 401,
    });
  }
  return request.actor;
}

function context(request: Request): RequestSecurityContext {
  return {
    requestId: String(request.id),
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}

function pageData<T>(result: { items: readonly T[]; nextCursor?: string }) {
  return {
    items: result.items,
    ...(result.nextCursor === undefined ? {} : { nextCursor: result.nextCursor }),
  };
}

export class OrganizationController {
  private readonly team = new TeamAccessService(prisma);
  constructor(private readonly service: OrganizationService = organizationService) {}

  publicBranches = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.publicBranches(
      validated<PublicBranchListQuery>(response, "query"),
    );
    response
      .status(200)
      .json(successResponse("Branches retrieved", request.id, pageData(result)));
  };

  publicBranch = async (request: Request, response: Response): Promise<void> => {
    const branch = await this.service.publicBranch(
      validated<{ branchId: string }>(response, "params").branchId,
    );
    response.status(200).json(successResponse("Branch retrieved", request.id, branch));
  };

  ownProfile = async (request: Request, response: Response): Promise<void> => {
    const profile = await this.service.ownStaffProfile(actor(request), context(request));
    response
      .status(200)
      .json(successResponse("Staff profile retrieved", request.id, profile));
  };

  branches = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.branches(
      actor(request),
      validated<AdminBranchListQuery>(response, "query"),
      context(request),
    );
    response
      .status(200)
      .json(successResponse("Branches retrieved", request.id, pageData(result)));
  };

  branch = async (request: Request, response: Response): Promise<void> => {
    const branch = await this.service.branch(
      actor(request),
      validated<{ branchId: string }>(response, "params").branchId,
      context(request),
    );
    response.status(200).json(successResponse("Branch retrieved", request.id, branch));
  };

  createBranch = async (request: Request, response: Response): Promise<void> => {
    const branch = await this.service.createBranch(
      actor(request),
      validated<BranchCreateInput>(response, "body"),
      context(request),
    );
    response.status(201).json(successResponse("Branch created", request.id, branch));
  };

  updateBranch = async (request: Request, response: Response): Promise<void> => {
    const branch = await this.service.updateBranch(
      actor(request),
      validated<{ branchId: string }>(response, "params").branchId,
      validated<BranchUpdateInput>(response, "body"),
      context(request),
    );
    response.status(200).json(successResponse("Branch updated", request.id, branch));
  };

  invite = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.invite(
      actor(request),
      validated<PrivilegedInvitationInput>(response, "body"),
      context(request),
    );
    response
      .status(202)
      .json(
        successResponse(
          "Invitation queued; delivery is not confirmed",
          request.id,
          result,
        ),
      );
  };

  acceptInvitation = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.acceptInvitation(
      actor(request),
      validated<PrivilegedInvitationAcceptInput>(response, "body"),
      context(request),
    );
    response
      .status(200)
      .json(
        successResponse(
          "Administrator invitation accepted; sign in again",
          request.id,
          result,
        ),
      );
  };

  candidates = async (request: Request, response: Response): Promise<void> => {
    const result = await this.team.search(
      actor(request),
      validated<{ email: string }>(response, "query").email,
      context(request),
    );
    response
      .status(200)
      .json(successResponse("Eligible account search completed", request.id, result));
  };
  promote = async (request: Request, response: Response): Promise<void> => {
    const result = await this.team.promote(
      actor(request),
      validated<StaffPromotionInput>(response, "body"),
      context(request),
    );
    response
      .status(200)
      .json(
        successResponse(
          "Customer promoted to staff; existing sessions revoked",
          request.id,
          result,
        ),
      );
  };
  invitations = async (request: Request, response: Response): Promise<void> => {
    const result = await this.team.list(
      actor(request),
      validated<InvitationListQuery>(response, "query"),
      context(request),
    );
    response
      .status(200)
      .json(successResponse("Invitations retrieved", request.id, result));
  };
  revokeInvitation = async (request: Request, response: Response): Promise<void> => {
    const result = await this.team.revoke(
      actor(request),
      validated<{ invitationId: string }>(response, "params").invitationId,
      validated<{ currentPassword: string }>(response, "body").currentPassword,
      context(request),
    );
    response.status(200).json(successResponse("Invitation revoked", request.id, result));
  };

  staffMembers = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.staffMembers(
      actor(request),
      validated<StaffListQuery>(response, "query"),
      context(request),
    );
    response
      .status(200)
      .json(successResponse("Staff retrieved", request.id, pageData(result)));
  };

  staffMember = async (request: Request, response: Response): Promise<void> => {
    const staff = await this.service.staffMember(
      actor(request),
      validated<{ staffUserId: string }>(response, "params").staffUserId,
      context(request),
    );
    response
      .status(200)
      .json(successResponse("Staff member retrieved", request.id, staff));
  };

  changeStatus = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.changeStatus(
      actor(request),
      validated<{ staffUserId: string }>(response, "params").staffUserId,
      validated<{ status: UserStatus }>(response, "body").status,
      context(request),
    );
    response
      .status(200)
      .json(successResponse("Staff status updated", request.id, result));
  };

  assignBranch = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.assignBranch(
      actor(request),
      validated<{ staffUserId: string }>(response, "params").staffUserId,
      validated<{ branchId: string }>(response, "body").branchId,
      context(request),
    );
    response
      .status(200)
      .json(successResponse("Staff branch updated", request.id, result));
  };

  changeRole = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.changeRole(
      actor(request),
      validated<{ staffUserId: string }>(response, "params").staffUserId,
      validated<StaffRoleInput>(response, "body"),
      context(request),
    );
    response.status(200).json(successResponse("Staff role updated", request.id, result));
  };
}
