import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { ConcernBooking } from "../../components/concern-booking";
import { browseEnquiriesOnly } from "@/lib/public-launch";
import "./request.css";
export const metadata = {
  title: "Describe a vehicle concern | Allied AutoTech",
  robots: { index: false, follow: true },
};
export default function ConcernRequestPage() {
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
            <h1>Tell us what your vehicle needs</h1>
            <p>
              Describe the problem and suggest a workshop visit. Our team will review the
              request before confirming a time or service.
            </p>
          </header>
          {browseEnquiriesOnly() ? (
            <section>
              <h2>Contact the workshop</h2>
              <p>Online booking requests are not available in this release.</p>
              <Link className="button" href="/contact#enquiry">
                Describe your concern
              </Link>
            </section>
          ) : (
            <ConcernBooking />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
