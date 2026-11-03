export interface PublicReleaseSettings {
  PUBLIC_LAUNCH_MODE: "full" | "browse_enquiries" | "catalogue";
  BOOKING_REQUESTS_ENABLED: boolean;
  PRODUCT_PURCHASES_ENABLED: boolean;
}

/** Independent release controls; policy/ownership/capacity checks still apply. */
export function bookingRequestsEnabled(settings: PublicReleaseSettings): boolean {
  return settings.PUBLIC_LAUNCH_MODE === "full" && settings.BOOKING_REQUESTS_ENABLED;
}

export function productPurchasesEnabled(settings: PublicReleaseSettings): boolean {
  return settings.PUBLIC_LAUNCH_MODE === "full" && settings.PRODUCT_PURCHASES_ENABLED;
}
