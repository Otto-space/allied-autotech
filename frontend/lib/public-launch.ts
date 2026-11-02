export type PublicLaunchMode = "full" | "browse_enquiries" | "catalogue";

/** Deployment configuration validation only. Customer availability comes from /public/capabilities. */
export function publicLaunchMode(): PublicLaunchMode {
  const mode = process.env.NEXT_PUBLIC_PUBLIC_LAUNCH_MODE?.trim() || "full";
  if (mode !== "full" && mode !== "browse_enquiries" && mode !== "catalogue")
    throw new Error(
      "NEXT_PUBLIC_PUBLIC_LAUNCH_MODE must be full, browse_enquiries or catalogue.",
    );
  return mode;
}
