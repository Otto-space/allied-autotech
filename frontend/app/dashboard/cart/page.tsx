import { getPublicCapabilities } from "@/lib/api/public-capabilities-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CartPanel } from "../../components/cart-panel";
export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};
export default async function CartPage() {
  if (!(await getPublicCapabilities()).checkoutEnabled) redirect("/contact#enquiry");
  return <CartPanel />;
}
