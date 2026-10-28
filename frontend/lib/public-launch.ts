export type PublicLaunchMode = "full" | "browse_enquiries" | "catalogue";

export function publicLaunchMode(): PublicLaunchMode {
  const mode = process.env.NEXT_PUBLIC_PUBLIC_LAUNCH_MODE?.trim() || "full";
  if (mode !== "full" && mode !== "browse_enquiries" && mode !== "catalogue")
    throw new Error(
      "NEXT_PUBLIC_PUBLIC_LAUNCH_MODE must be full, browse_enquiries or catalogue.",
    );
  return mode;
}

export function browseEnquiriesOnly() {
  // Both limited releases suppress checkout, booking and reservation actions.
  return publicLaunchMode() !== "full";
}

export function catalogueOnly() {
  return publicLaunchMode() === "catalogue";
}

export function restrictedLaunchPage(pathname: string) {
  if (catalogueOnly() && /^\/(?:register|dashboard|payments)(?:\/|$)/i.test(pathname))
    return true;
  return /^\/dashboard\/(?:cart|orders|bookings|payments|vehicle-transactions|inspections|invoices)(?:\/|$)/i.test(
    pathname,
  );
}
