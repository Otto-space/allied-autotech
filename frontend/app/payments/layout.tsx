import { getPublicCapabilities } from "@/lib/api/public-capabilities-server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
export default async function PaymentLayout({ children }: { children: ReactNode }) {
  if ((await getPublicCapabilities()).mode === "catalogue") redirect("/contact#enquiry");
  return children;
}
