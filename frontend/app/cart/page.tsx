import { getPublicCapabilities } from "@/lib/api/public-capabilities-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { PurchaseCart } from "../components/purchase-cart";
import "../purchase/purchase.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

export default async function Page() {
  if (!(await getPublicCapabilities()).checkoutEnabled) redirect("/contact#enquiry");
  const jar = await cookies();
  // Presence only selects the existing account route; its normal auth/MFA guard
  // remains authoritative. Guest credentials never enter account checkout.
  if (jar.has("__Host-aat_session") || jar.has("aat_session"))
    redirect("/dashboard/cart");
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="purchase-page" data-no-draft>
        <PurchaseCart />
      </main>
      <SiteFooter />
    </>
  );
}
