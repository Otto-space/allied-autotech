import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { registerIdentityOpenApi } from "../modules/identity/identity.openapi.js";
import { registerCustomersOpenApi } from "../modules/customers/customers.openapi.js";
import { registerOrganizationOpenApi } from "../modules/organization/organization.openapi.js";
import { registerCatalogOpenApi } from "../modules/catalog/catalog.openapi.js";
import { registerInventoryOpenApi } from "../modules/inventory/inventory.openapi.js";
import { registerServiceOperationsOpenApi } from "../modules/service-operations/service-operations.openapi.js";
import { registerOrdersOpenApi } from "../modules/orders/orders.openapi.js";
import { registerPromotionsOpenApi } from "../modules/promotions/promotions.openapi.js";
import { registerBillingOpenApi } from "../modules/billing/billing.openapi.js";
import { registerVehiclesOpenApi } from "../modules/vehicles/vehicles.openapi.js";
import { registerVehicleSalesOpenApi } from "../modules/vehicle-sales/vehicle-sales.openapi.js";
import { registerPaymentsOpenApi } from "../modules/payments/payments.openapi.js";

export function createOpenApiDocument() {
  const registry = new OpenAPIRegistry();
  registerIdentityOpenApi(registry);
  registerCustomersOpenApi(registry);
  registerOrganizationOpenApi(registry);
  registerCatalogOpenApi(registry);
  registerInventoryOpenApi(registry);
  registerServiceOperationsOpenApi(registry);
  registerOrdersOpenApi(registry);
  registerPromotionsOpenApi(registry);
  registerBillingOpenApi(registry);
  registerVehiclesOpenApi(registry);
  registerVehicleSalesOpenApi(registry);
  registerPaymentsOpenApi(registry);
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Allied AutoTech API",
      version: "1.0.0",
      description:
        "Versioned REST API contracts for Allied AutoTech. Runtime schemas will be registered alongside each domain route.",
    },
    servers: [{ url: "/api/v1", description: "Current API version" }],
  });
}
