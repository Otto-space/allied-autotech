import { z } from "zod";
import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { ConcernBooking } from "../../components/concern-booking";
import { getPublicCapabilities } from "@/lib/api/public-capabilities-server";
import "./request.css";
export const metadata = {
  title: "Describe a vehicle concern | Allied AutoTech",
  robots: { index: false, follow: true },
};
export default async function ConcernRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceGroup?: string }>;
}) {
  const { bookingRequestsEnabled } = await getPublicCapabilities();
  const query = await searchParams;
  const serviceGroup = z.uuid().safeParse(query.serviceGroup).data;
  const enquiryHref = serviceGroup
    ? `/contact?serviceGroup=${serviceGroup}#enquiry`
    : "/contact#enquiry";
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site concern-page">
        <nav className="public-wrap" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/services">Services</Link>
            </li>
            <li>
              <span aria-current="page">Describe a concern</span>
            </li>
          </ol>
        </nav>
        <div className="public-wrap concern-layout">
          <header>
            <p className="concern-eyebrow">Workshop requests</p>
            <h1>Tell us what your vehicle needs</h1>
            <p>
              {bookingRequestsEnabled
                ? "Describe the problem and suggest a workshop visit. Our team will review the request before confirming a time or service."
                : "Tell the workshop what you have noticed about your vehicle and discuss the next step with our team."}
            </p>
          </header>
          {!bookingRequestsEnabled ? (
            <section className="concern-unavailable">
              <h2>Contact the workshop</h2>
              <p>
                Online booking requests are unavailable right now. Contact our team to
                discuss your vehicle and agree visit arrangements.
              </p>
              <Link className="button" href={enquiryHref}>
                Describe your concern
              </Link>
            </section>
          ) : (
            <ConcernBooking
              key={serviceGroup ?? "general"}
              initialServiceGroup={serviceGroup}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
