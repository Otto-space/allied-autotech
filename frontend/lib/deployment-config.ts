import { backendOrigin } from "./backend-origin";
import { siteOrigin } from "./seo";

/** Validate configured origins; an omitted API enables a frontend-only deployment. */
export function validateDeploymentConfig() {
  backendOrigin();
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "production") return;

  const origin = siteOrigin();
  if (!origin) {
    throw new Error(
      "SITE_ORIGIN is required for production and must be the frontend HTTPS origin without credentials, a port, path, query or fragment.",
    );
  }
  if (origin === backendOrigin()) {
    throw new Error(
      "BACKEND_ORIGIN must point to the API host, not the frontend SITE_ORIGIN.",
    );
  }
  const indexing = process.env.SITE_INDEXING?.trim();
  if (indexing && !["enabled", "disabled"].includes(indexing)) {
    throw new Error("SITE_INDEXING must be enabled or disabled.");
  }
}
