import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import Link from "next/link";
import { ContactInvitation } from "../components/brand-editorial";
import { HelpCentre } from "../components/help-centre";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  return publicPageMetadata(
    "Help centre",
    "Help with Allied AutoTech service bookings, payments, account access and finding our Port Harcourt workshop.",
    "/help",
    searchParams,
  );
}
export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site help-page">
        <div className="public-wrap help-content">
          <p className="eyebrow">Customer care</p>
          <h1>Help, when you need it.</h1>
          <p className="lead">
            Find your next step, from booking a visit to checking a payment.
          </p>
          <HelpCentre />
          <div className="help-next">
            <h2>Keep the conversation going.</h2>
            <p>Send an enquiry or complaint, or follow a request in your account.</p>
            <div className="actions">
              <Link className="button" href="/contact#enquiry">
                Contact customer care
              </Link>
              <Link className="button secondary" href="/dashboard/support">
                My support requests
              </Link>
            </div>
          </div>
        </div>
        <ContactInvitation />
      </main>
      <SiteFooter />
    </>
  );
}
