import type { PublicCapabilities } from "@/lib/public-capabilities";
import type { PublicLaunchMode } from "@/lib/public-launch";

export function publicCapabilitiesFixture(
  mode: PublicLaunchMode = "browse_enquiries",
  checkoutEnabled = mode === "full",
): PublicCapabilities {
  return {
    scope: "POLICY_SUMMARY",
    serverTime: "2026-11-02T12:00:00Z",
    release: {
      mode,
      customerAccountsEnabled: mode !== "catalogue",
      enquiriesEnabled: mode !== "catalogue",
      bookingRequestsEnabled: mode === "full",
      inspectionRequestsEnabled: mode === "full",
    },
    checkoutEnabled,
    vehicleDeposits: { enabled: false },
  };
}
