import { Router } from "express";

import { publicRouterPaths } from "../../common/contracts/public-api.js";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireAdministrator,
  requireStaff,
  requireSuperAdministrator,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { OrganizationController } from "./organization.controller.js";
import {
  adminBranchListQuerySchema,
  branchCreateBodySchema,
  branchParamsSchema,
  branchUpdateBodySchema,
  organizationEmptyQuerySchema,
  privilegedInvitationAcceptBodySchema,
  privilegedInvitationBodySchema,
  publicBranchListQuerySchema,
  staffBranchBodySchema,
  staffListQuerySchema,
  staffParamsSchema,
  staffRoleBodySchema,
  staffStatusBodySchema,
  accountSearchQuerySchema,
  invitationListQuerySchema,
  invitationParamsSchema,
  invitationRevokeBodySchema,
  staffPromotionBodySchema,
} from "./organization.schemas.js";

export function createPublicBranchesRouter(): Router {
  const router = Router();
  const controller = new OrganizationController();
  router.get(
    publicRouterPaths.collection,
    validate({ query: publicBranchListQuerySchema }),
    controller.publicBranches,
  );
  router.get(
    publicRouterPaths.branch,
    validate({ params: branchParamsSchema, query: organizationEmptyQuerySchema }),
    controller.publicBranch,
  );
  return router;
}

export function createStaffOrganizationRouter(): Router {
  const router = Router();
  const controller = new OrganizationController();
  router.use(authenticate(), requireStaff);
  router.get(
    "/profile",
    validate({ query: organizationEmptyQuerySchema }),
    controller.ownProfile,
  );
  return router;
}

export function createAdminOrganizationRouter(): Router {
  const router = Router();
  const controller = new OrganizationController();
  router.use(authenticate(), requireAdministrator);

  router.get(
    "/branches",
    validate({ query: adminBranchListQuerySchema }),
    controller.branches,
  );
  router.post(
    "/branches",
    requireCsrf,
    validate({ body: branchCreateBodySchema, query: organizationEmptyQuerySchema }),
    controller.createBranch,
  );
  router.get(
    "/branches/:branchId",
    validate({ params: branchParamsSchema, query: organizationEmptyQuerySchema }),
    controller.branch,
  );
  router.patch(
    "/branches/:branchId",
    requireCsrf,
    validate({
      params: branchParamsSchema,
      body: branchUpdateBodySchema,
      query: organizationEmptyQuerySchema,
    }),
    controller.updateBranch,
  );
  router.get(
    "/staff",
    validate({ query: staffListQuerySchema }),
    controller.staffMembers,
  );
  router.get(
    "/staff/candidates",
    createSensitiveRateLimit(30),
    validate({ query: accountSearchQuerySchema }),
    controller.candidates,
  );
  router.post(
    "/staff/promotions",
    requireCsrf,
    createSensitiveRateLimit(10),
    validate({ body: staffPromotionBodySchema, query: organizationEmptyQuerySchema }),
    controller.promote,
  );
  router.get(
    "/staff/invitations",
    validate({ query: invitationListQuerySchema }),
    controller.invitations,
  );
  router.post(
    "/staff/invitations/:invitationId/revoke",
    requireCsrf,
    createSensitiveRateLimit(10),
    validate({
      params: invitationParamsSchema,
      body: invitationRevokeBodySchema,
      query: organizationEmptyQuerySchema,
    }),
    controller.revokeInvitation,
  );
  router.get(
    "/staff/:staffUserId",
    validate({ params: staffParamsSchema, query: organizationEmptyQuerySchema }),
    controller.staffMember,
  );
  router.post(
    "/staff/invitations",
    createSensitiveRateLimit(20, 60 * 60 * 1_000),
    requireCsrf,
    validate({
      body: privilegedInvitationBodySchema,
      query: organizationEmptyQuerySchema,
    }),
    controller.invite,
  );
  router.patch(
    "/staff/:staffUserId/status",
    requireCsrf,
    validate({
      params: staffParamsSchema,
      body: staffStatusBodySchema,
      query: organizationEmptyQuerySchema,
    }),
    controller.changeStatus,
  );
  router.patch(
    "/staff/:staffUserId/branch",
    requireCsrf,
    validate({
      params: staffParamsSchema,
      body: staffBranchBodySchema,
      query: organizationEmptyQuerySchema,
    }),
    controller.assignBranch,
  );
  router.patch(
    "/staff/:staffUserId/role",
    requireSuperAdministrator,
    requireCsrf,
    validate({
      params: staffParamsSchema,
      body: staffRoleBodySchema,
      query: organizationEmptyQuerySchema,
    }),
    controller.changeRole,
  );
  return router;
}

export function createPrivilegedInvitationRouter(): Router {
  const router = Router();
  const controller = new OrganizationController();
  router.post(
    "/accept",
    createSensitiveRateLimit(10, 60 * 60 * 1_000),
    authenticate(),
    requireStaff,
    requireCsrf,
    validate({
      body: privilegedInvitationAcceptBodySchema,
      query: organizationEmptyQuerySchema,
    }),
    controller.acceptInvitation,
  );
  return router;
}
