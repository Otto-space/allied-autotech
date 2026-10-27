import { publicLaunchMode } from "./public-launch";
import { frontendProxySecret } from "./backend-client-address";
import { backendOrigin } from "./backend-origin";
import { siteOrigin } from "./seo";
import { privateTestingAuthorization } from "./private-testing";

/** Validate supplied origins; an omitted site origin keeps search indexing disabled. */
export function validateDeploymentConfig() {
  publicLaunchMode();
  frontendProxySecret();
  privateTestingAuthorization();
  const apiOrigin = backendOrigin();
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "production") return;
  if (apiOrigin && publicLaunchMode() === "browse_enquiries" && !frontendProxySecret())
    throw new Error(
      "Production browsing launch requires verified backend client forwarding.",
    );

  const origin = siteOrigin();
  if (process.env.SITE_ORIGIN?.trim() && !origin) {
    throw new Error(
      "SITE_ORIGIN, when set, must be the frontend HTTPS origin without credentials, a port, path, query or fragment.",
    );
  }
  if (origin && origin === apiOrigin) {
    throw new Error(
      "BACKEND_ORIGIN must point to the API host, not the frontend SITE_ORIGIN.",
    );
  }
  const indexing = process.env.SITE_INDEXING?.trim();
  if (indexing && !["enabled", "disabled"].includes(indexing)) {
    throw new Error("SITE_INDEXING must be enabled or disabled.");
  }
}
