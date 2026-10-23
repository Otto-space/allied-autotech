import { registerFitmentOpenApi } from "../modules/fitment/fitment.openapi.js";
import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { registerIdentityOpenApi } from "../modules/identity/identity.openapi.js";
import { registerCustomersOpenApi } from "../modules/customers/customers.openapi.js";
import { registerCustomerDirectoryOpenApi } from "../modules/customers/customer-directory.openapi.js";
import { registerProfilePhotoOpenApi } from "../modules/customers/profile-photo.openapi.js";
import { registerGarageMediaOpenApi } from "../modules/customers/garage-media.openapi.js";
import { registerServiceMediaOpenApi } from "../modules/service-operations/service-media.openapi.js";
import { registerProductMediaOpenApi } from "../modules/catalog/product-media.openapi.js";
import { registerOrganizationOpenApi } from "../modules/organization/organization.openapi.js";
import { registerCatalogOpenApi } from "../modules/catalog/catalog.openapi.js";
import { registerInventoryOpenApi } from "../modules/inventory/inventory.openapi.js";
import { registerServiceOperationsOpenApi } from "../modules/service-operations/service-operations.openapi.js";
import { registerServiceDiscoveryOpenApi } from "../modules/service-operations/service-discovery.openapi.js";
import { registerOrdersOpenApi } from "../modules/orders/orders.openapi.js";
import { registerPromotionsOpenApi } from "../modules/promotions/promotions.openapi.js";
import { registerBillingOpenApi } from "../modules/billing/billing.openapi.js";
import { registerVehiclesOpenApi } from "../modules/vehicles/vehicles.openapi.js";
import { registerVehicleSalesOpenApi } from "../modules/vehicle-sales/vehicle-sales.openapi.js";
import { registerPaymentsOpenApi } from "../modules/payments/payments.openapi.js";
import { registerResendWebhookOpenApi } from "../providers/messaging/resend-webhook.openapi.js";
import { registerSupportOpenApi } from "../modules/support/support.openapi.js";
import { registerNotificationsOpenApi } from "../modules/notifications/notifications.openapi.js";
import { registerAuditOpenApi } from "../modules/audit/audit.openapi.js";
import { hardenOpenApiDocument } from "./harden-document.js";
import { registerOverviewOpenApi } from "../modules/overview/overview.openapi.js";
import { registerOwnerPolicyOpenApi } from "../modules/policies/policies.openapi.js";
import { registerWorkforceOpenApi } from "../modules/organization/workforce.openapi.js";

export interface OpenApiDocumentOptions {
  sessionCookieName: string;
}

export function createOpenApiDocument(options: OpenApiDocumentOptions) {
  const registry = new OpenAPIRegistry();
  registerIdentityOpenApi(registry, options.sessionCookieName);
  registerCustomersOpenApi(registry);
  registerCustomerDirectoryOpenApi(registry);
  registerProfilePhotoOpenApi(registry);
  registerGarageMediaOpenApi(registry);
  registerServiceMediaOpenApi(registry);
  registerProductMediaOpenApi(registry);
  registerOrganizationOpenApi(registry);
  registerCatalogOpenApi(registry);
  registerInventoryOpenApi(registry);
  registerServiceOperationsOpenApi(registry);
  registerServiceDiscoveryOpenApi(registry);
  registerOrdersOpenApi(registry);
  registerPromotionsOpenApi(registry);
  registerBillingOpenApi(registry);
  registerVehiclesOpenApi(registry);
  registerFitmentOpenApi(registry);
  registerVehicleSalesOpenApi(registry);
  registerPaymentsOpenApi(registry);
  registerResendWebhookOpenApi(registry);
  registerSupportOpenApi(registry);
  registerNotificationsOpenApi(registry);
  registerAuditOpenApi(registry);
  registerOverviewOpenApi(registry);
  registerOwnerPolicyOpenApi(registry);
  registerWorkforceOpenApi(registry);
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return hardenOpenApiDocument(
    generator.generateDocument({
      openapi: "3.1.0",
      info: {
        title: "Allied AutoTech API",
        version: "1.0.0",
        description:
          "Versioned REST API contracts for Allied AutoTech. When PUBLIC_LAUNCH_MODE=browse_enquiries, customer transaction writes return 403 while public catalogue reads, enquiries and existing authentication remain available. Staff and administrator operations retain their normal permission checks.",
      },
      servers: [{ url: "/api/v1", description: "Current API version" }],
    }),
  );
}
