export type PublicLaunchMode = "full" | "browse_enquiries";

export function publicLaunchMode(): PublicLaunchMode {
  const mode = process.env.NEXT_PUBLIC_PUBLIC_LAUNCH_MODE?.trim() || "full";
  if (mode !== "full" && mode !== "browse_enquiries")
    throw new Error("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE must be full or browse_enquiries.");
  return mode;
}

export function browseEnquiriesOnly() {
  return publicLaunchMode() === "browse_enquiries";
}

export function restrictedLaunchPage(pathname: string) {
  return /^\/dashboard\/(?:cart|orders|bookings|payments|vehicle-transactions|inspections|invoices)(?:\/|$)/i.test(
    pathname,
  );
}
