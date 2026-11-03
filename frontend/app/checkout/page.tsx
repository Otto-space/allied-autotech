import { getPublicCapabilities } from "@/lib/api/public-capabilities-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Page() {
  if (!(await getPublicCapabilities()).checkoutEnabled) redirect("/contact#enquiry");
  const jar = await cookies();
  if (jar.has("__Host-aat_session") || jar.has("aat_session"))
    redirect("/dashboard/cart#cart-checkout-form");
  redirect("/cart");
}
