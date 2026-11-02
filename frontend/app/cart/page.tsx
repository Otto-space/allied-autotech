import { getPublicCapabilities } from "@/lib/api/public-capabilities-server";
import { redirect } from "next/navigation";

export default async function Page() {
  if (!(await getPublicCapabilities()).checkoutEnabled) redirect("/contact#enquiry");
  redirect("/dashboard/cart");
}
