import { Router } from "express";

import { createHealthRouter } from "../modules/health/health.routes.js";
import { createIdentityRouter } from "../modules/identity/identity.index.js";
import { createCustomersRouter } from "../modules/customers/customers.index.js";
import {
  createAdminOrganizationRouter,
  createPrivilegedInvitationRouter,
  createPublicBranchesRouter,
  createStaffOrganizationRouter,
} from "../modules/organization/organization.index.js";
import { createOpenApiDocument } from "../openapi/document.js";
import type { ReadinessCheck } from "../modules/health/health.controller.js";

export interface ApiRouterOptions {
  checkReadiness: ReadinessCheck;
}

export function createApiRouter(options: ApiRouterOptions): Router {
  const apiRouter = Router();

  apiRouter.use("/health", createHealthRouter(options.checkReadiness));
  apiRouter.use("/auth", createIdentityRouter());
  apiRouter.use("/auth/staff/invitations", createPrivilegedInvitationRouter());
  apiRouter.use("/public/branches", createPublicBranchesRouter());
  apiRouter.use("/customers", createCustomersRouter());
  apiRouter.use("/staff", createStaffOrganizationRouter());
  apiRouter.use("/admin", createAdminOrganizationRouter());
  apiRouter.get("/openapi.json", (_req, res): void => {
    res.status(200).json(createOpenApiDocument());
  });

  return apiRouter;
}
