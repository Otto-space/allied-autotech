import type { WorkforceAccess } from "./api/workforce-schemas";
import { workforceDestinationAllowed } from "./workforce-registry";

// Both the navigation and direct page mount consume the server's capability
// projection. A display position or template name is never a client-side grant.
export function canUseWorkforceFitment(access: WorkforceAccess): boolean {
  return workforceDestinationAllowed(access, "fitment");
}
