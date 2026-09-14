const allowedAuthenticatedPaths = [
  "/dashboard",
  "/dashboard/bookings",
  "/dashboard/security",
  "/services",
  "/parts",
  "/vehicles",
  "/admin",
];

export function safeInternalRedirect(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/dashboard";
  }
  try {
    const parsed = new URL(value, "https://same-origin.invalid");
    if (parsed.origin !== "https://same-origin.invalid") return "/dashboard";
    return allowedAuthenticatedPaths.some(
      (path) => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`),
    )
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
