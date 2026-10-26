import { createFitmentRouter } from "../modules/fitment/fitment.routes.js";
import { createLearningRouter } from "../modules/learning/learning.routes.js";
import { createServiceDiscoveryRouter } from "../modules/service-operations/service-discovery.routes.js";
import { createOrderAftercareRouter } from "../modules/orders/order-aftercare.routes.js";
import { createPrivacyRouter } from "../modules/policies/privacy.routes.js";
import { createBookingActionsRouter } from "../modules/service-operations/booking-actions.routes.js";
import { createPoliciesRouter } from "../modules/policies/policies.routes.js";
import { createManualRefundsRouter } from "../modules/payments/manual-refunds.routes.js";
import { Router } from "express";
import { createResendWebhookRouter } from "../providers/messaging/resend-webhook.routes.js";
import { publicLaunch } from "../common/middleware/public-launch.js";

import { publicApiPaths } from "../common/contracts/public-api.js";
import { sessionCookieName } from "../common/security/cookies.js";
import { createHealthRouter } from "../modules/health/health.routes.js";
import { createIdentityRouter } from "../modules/identity/identity.index.js";
import { createCustomersRouter } from "../modules/customers/customers.index.js";
import { createCustomerDirectoryRouter } from "../modules/customers/customer-directory.routes.js";
import { createProfilePhotoRouter } from "../modules/customers/profile-photo.routes.js";
import { createGarageMediaRouter } from "../modules/customers/garage-media.routes.js";
import {
  createProductMediaRouter,
  createPublicProductMediaRouter,
} from "../modules/catalog/product-media.routes.js";
import {
  createServiceMediaRouter,
  createPublicServiceMediaRouter,
} from "../modules/service-operations/service-media.routes.js";
import {
  createAdminCatalogRouter,
  createCustomerCatalogRouter,
  createPublicCatalogRouter,
} from "../modules/catalog/catalog.index.js";
import {
  createAdminInventoryRouter,
  createStaffInventoryRouter,
} from "../modules/inventory/inventory.index.js";
import {
  createAdminOrganizationRouter,
  createPrivilegedInvitationRouter,
  createPublicBranchesRouter,
  createStaffOrganizationRouter,
} from "../modules/organization/organization.index.js";
import {
  createAdminServicesRouter,
  createCustomerServiceOperationsRouter,
  createPublicServicesRouter,
  createPublicBookingRouter,
  createStaffServiceOperationsRouter,
} from "../modules/service-operations/service-operations.index.js";
import {
  createAdminOrderOperationsRouter,
  createCustomerOrdersRouter,
  createStaffOrdersRouter,
} from "../modules/orders/orders.index.js";
import {
  createAdminPromotionsRouter,
  createCustomerPromotionsRouter,
} from "../modules/promotions/promotions.index.js";
import {
  createCustomerBillingRouter,
  createStaffBillingRouter,
} from "../modules/billing/billing.index.js";
import { createOpenApiDocument } from "../openapi/document.js";
import type { ReadinessCheck } from "../modules/health/health.controller.js";
import {
  createCustomerVehiclesDiscoveryRouter,
  createPublicVehiclesRouter,
  createStaffVehiclesRouter,
} from "../modules/vehicles/vehicles.index.js";
import {
  createAdminVehicleSalesRouter,
  createCustomerVehicleSalesRouter,
  createStaffVehicleSalesRouter,
} from "../modules/vehicle-sales/vehicle-sales.index.js";
import { env } from "../config/env.js";
import {
  createCustomerPaymentsRouter,
  createMonnifyWebhookRouter,
  createPaystackWebhookRouter,
  createStaffPaymentsRouter,
} from "../modules/payments/payments.index.js";
import {
  swaggerSecurityHeaders,
  swaggerServe,
  swaggerSetup,
} from "../openapi/swagger.js";
import {
  createCustomerSupportRouter,
  createPublicSupportRouter,
  createStaffSupportRouter,
} from "../modules/support/support.index.js";
import {
  createCustomerNotificationsRouter,
  createStaffNotificationsRouter,
} from "../modules/notifications/notifications.index.js";
import { createAuditOperationsRouter } from "../modules/audit/audit.index.js";
import { createOverviewRouter } from "../modules/overview/overview.routes.js";
import { createWorkforceRouter } from "../modules/organization/workforce.routes.js";

export interface ApiRouterOptions {
  checkReadiness: ReadinessCheck;
}

import { createDisputesRouter } from "../modules/payments/disputes.routes.js";

export function createApiRouter(options: ApiRouterOptions): Router {
  const apiRouter = Router();
  apiRouter.use(publicLaunch(env.PUBLIC_LAUNCH_MODE));
  apiRouter.use(createLearningRouter());
  apiRouter.use(createWorkforceRouter());
  apiRouter.use(createPoliciesRouter());
  apiRouter.use(createPrivacyRouter());
  apiRouter.use(createOrderAftercareRouter());
  apiRouter.use("/public/booking-response", createBookingActionsRouter());
  apiRouter.use("/staff/refunds", createManualRefundsRouter());
  apiRouter.use("/staff/disputes", createDisputesRouter());

  apiRouter.use("/health", createHealthRouter(options.checkReadiness));
  apiRouter.use("/auth", createIdentityRouter());
  apiRouter.use("/customers/overview", createOverviewRouter("customer"));
  apiRouter.use("/staff/overview", createOverviewRouter("staff"));
  apiRouter.use("/auth/staff/invitations", createPrivilegedInvitationRouter());
  apiRouter.use(publicApiPaths.branches, createPublicBranchesRouter());
  apiRouter.use("/public", createPublicBookingRouter());
  apiRouter.use("/public", createPublicServiceMediaRouter());
  apiRouter.use("/public/catalog", createPublicCatalogRouter());
  apiRouter.use("/public/catalog", createPublicProductMediaRouter());
  apiRouter.use(createServiceDiscoveryRouter());
  apiRouter.use(publicApiPaths.services, createPublicServicesRouter());
  apiRouter.use("/public/vehicles", createPublicVehiclesRouter());
  apiRouter.use("/public/support", createPublicSupportRouter());
  apiRouter.use("/customers", createCustomerCatalogRouter());
  apiRouter.use("/customers", createCustomersRouter());
  apiRouter.use("/customers", createProfilePhotoRouter());
  apiRouter.use("/customers", createGarageMediaRouter());
  apiRouter.use("/admin/customers", createCustomerDirectoryRouter());
  apiRouter.use("/customers", createCustomerServiceOperationsRouter());
  apiRouter.use("/customers/orders", createCustomerOrdersRouter());
  apiRouter.use("/customers/promotions", createCustomerPromotionsRouter());
  apiRouter.use("/customers/invoices", createCustomerBillingRouter());
  apiRouter.use("/customers/payments", createCustomerPaymentsRouter());
  apiRouter.use("/customers", createCustomerVehiclesDiscoveryRouter());
  apiRouter.use("/customers", createCustomerVehicleSalesRouter());
  apiRouter.use("/customers/support", createCustomerSupportRouter());
  apiRouter.use("/customers/notifications", createCustomerNotificationsRouter());
  apiRouter.use("/staff/inventory", createStaffInventoryRouter());
  apiRouter.use("/staff", createStaffOrganizationRouter());
  apiRouter.use("/staff", createStaffServiceOperationsRouter());
  apiRouter.use("/staff/orders", createStaffOrdersRouter());
  apiRouter.use("/staff/invoices", createStaffBillingRouter());
  apiRouter.use("/staff/payments", createStaffPaymentsRouter());
  apiRouter.use("/staff/vehicles", createStaffVehiclesRouter());
  apiRouter.use("/staff", createStaffVehicleSalesRouter());
  apiRouter.use("/staff/support", createStaffSupportRouter());
  apiRouter.use("/staff/notifications", createStaffNotificationsRouter());
  apiRouter.use("/admin/catalog", createAdminCatalogRouter());
  apiRouter.use("/admin/catalog", createProductMediaRouter());
  apiRouter.use("/admin/inventory", createAdminInventoryRouter());
  apiRouter.use("/admin/services", createAdminServicesRouter());
  apiRouter.use("/admin/services", createServiceMediaRouter());
  apiRouter.use("/admin/orders", createAdminOrderOperationsRouter());
  apiRouter.use("/admin/promotions", createAdminPromotionsRouter());
  apiRouter.use("/admin", createAdminVehicleSalesRouter());
  apiRouter.use("/admin", createAdminOrganizationRouter());
  apiRouter.use("/admin", createAuditOperationsRouter());
  apiRouter.use("/webhooks/paystack", createPaystackWebhookRouter());
  apiRouter.use("/webhooks/monnify", createMonnifyWebhookRouter());
  apiRouter.use("/webhooks/resend", createResendWebhookRouter());
  if (env.API_DOCS_ENABLED) {
    apiRouter.get("/openapi.json", (_req, res): void => {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(createOpenApiDocument({ sessionCookieName }));
    });
    apiRouter.use("/docs", swaggerSecurityHeaders, swaggerServe, swaggerSetup);
  }

  apiRouter.use(createFitmentRouter());
  return apiRouter;
}
