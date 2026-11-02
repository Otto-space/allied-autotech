import { z } from "zod";
import type { PublicLaunchMode } from "./public-launch";

export const publicCapabilitiesSchema = z.object({
  scope: z.literal("POLICY_SUMMARY"),
  serverTime: z.iso.datetime(),
  release: z.object({
    mode: z.enum(["full", "browse_enquiries", "catalogue"]),
    customerAccountsEnabled: z.boolean(),
    enquiriesEnabled: z.boolean(),
    bookingRequestsEnabled: z.boolean(),
    inspectionRequestsEnabled: z.boolean(),
  }),
  checkoutEnabled: z.boolean(),
  vehicleDeposits: z.object({ enabled: z.boolean() }),
});
export type PublicCapabilities = z.infer<typeof publicCapabilitiesSchema>;
export type CapabilitySnapshot = PublicCapabilities | null;

export function parsePublicCapabilities(value: unknown): PublicCapabilities {
  const parsed = publicCapabilitiesSchema.parse(value);
  const { mode } = parsed.release;
  if (
    parsed.release.customerAccountsEnabled !== (mode !== "catalogue") ||
    parsed.release.enquiriesEnabled !== (mode !== "catalogue") ||
    parsed.release.bookingRequestsEnabled !== (mode === "full") ||
    parsed.release.inspectionRequestsEnabled !== (mode === "full") ||
    (mode !== "full" && (parsed.checkoutEnabled || parsed.vehicleDeposits.enabled)) ||
    (parsed.vehicleDeposits.enabled && !parsed.checkoutEnabled)
  )
    throw Error("Availability could not be verified");
  return parsed;
}

// Informational availability never replaces backend authentication or write guards.
export function capabilityView(
  snapshot: CapabilitySnapshot,
  previousMode: PublicLaunchMode | null = null,
) {
  const mode: PublicLaunchMode | null = snapshot?.release.mode ?? previousMode;
  const checkoutEnabled = snapshot?.checkoutEnabled === true;
  const browseEnquiriesOnly = () => snapshot === null || mode !== "full";
  const catalogueOnly = () => mode === null || mode === "catalogue";
  const restrictedLaunchPage = (pathname: string) =>
    (mode === "catalogue" &&
      /^\/(?:register|dashboard|payments)(?:\/|$)/i.test(pathname)) ||
    (mode === null && /^\/register(?:\/|$)/i.test(pathname)) ||
    (!checkoutEnabled && /^\/(?:cart|checkout|dashboard\/cart)(?:\/|$)/i.test(pathname));
  return {
    snapshot,
    mode,
    checkoutEnabled,
    bookingRequestsEnabled: snapshot?.release.bookingRequestsEnabled === true,
    inspectionRequestsEnabled: snapshot?.release.inspectionRequestsEnabled === true,
    enquiriesEnabled: snapshot?.release.enquiriesEnabled === true,
    customerAccountsEnabled: snapshot?.release.customerAccountsEnabled === true,
    browseEnquiriesOnly,
    catalogueOnly,
    restrictedLaunchPage,
  };
}

export function capabilityKey(value: CapabilitySnapshot): string {
  if (!value) return "unavailable";
  return JSON.stringify([value.release, value.checkoutEnabled, value.vehicleDeposits]);
}
