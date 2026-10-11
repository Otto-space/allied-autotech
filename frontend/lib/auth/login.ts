import { z } from "zod";
import { safeInternalRedirect } from "./safe-redirect";
export const loginResponse = z
  .object({
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
    }),
    mfaRequired: z.boolean(),
  })
  .refine(
    (value) => value.user.role === "CUSTOMER" || value.mfaRequired,
    "Work accounts require security verification",
  );
export function loginDestination(
  data: z.infer<typeof loginResponse>,
  next: string | null,
) {
  if (data.mfaRequired) return "/mfa";
  const path = safeInternalRedirect(next);
  return path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/admin?") ||
    path.startsWith("/admin#")
    ? "/dashboard"
    : path;
}
