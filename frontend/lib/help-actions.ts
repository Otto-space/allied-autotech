export type HelpAccess = "checking" | "anonymous" | "customer" | "work" | "error";

export function resolveHelpAction(
  article: { href: string; action: string },
  access: HelpAccess,
): { href: string; label: string } | { notice: string } | null {
  if (!article.href.startsWith("/dashboard/"))
    return { href: article.href, label: article.action };
  if (access === "checking" || access === "error") return null;
  if (access === "anonymous")
    return {
      href: `/login?next=${encodeURIComponent(article.href)}`,
      label: "Sign in to continue",
    };
  if (access === "customer") return { href: article.href, label: article.action };
  if (article.href === "/dashboard/security")
    return { href: "/admin/security", label: article.action };
  if (article.href === "/dashboard/support")
    return { href: "/admin/support", label: "Open support workspace" };
  return { notice: "This action is available to customer accounts." };
}
