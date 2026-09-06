import type { RequestHandler } from "express";
import swaggerUi from "swagger-ui-express";

import { sessionCookieName } from "../common/security/cookies.js";
import { createOpenApiDocument } from "./document.js";

export const swaggerSecurityHeaders: RequestHandler = (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  next();
};

export const swaggerServe = swaggerUi.serve;
export const swaggerSetup = swaggerUi.setup(
  createOpenApiDocument({ sessionCookieName }),
  {
    customSiteTitle: "Allied AutoTech API Documentation",
    swaggerOptions: {
      persistAuthorization: false,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: false,
    },
  },
);
