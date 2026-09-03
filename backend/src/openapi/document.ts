import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { registerIdentityOpenApi } from "../modules/identity/identity.openapi.js";
import { registerCustomersOpenApi } from "../modules/customers/customers.openapi.js";
import { registerOrganizationOpenApi } from "../modules/organization/organization.openapi.js";

export function createOpenApiDocument() {
  const registry = new OpenAPIRegistry();
  registerIdentityOpenApi(registry);
  registerCustomersOpenApi(registry);
  registerOrganizationOpenApi(registry);
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Allied AutoTech API",
      version: "1.0.0",
      description:
        "Versioned REST API contracts for Allied AutoTech. Runtime schemas will be registered alongside each domain route.",
    },
    servers: [{ url: "/api/v1" }],
  });
}
