import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { HelpCentre } from "../components/help-centre";
export const metadata: Metadata = {
  title: "Help centre",
  description:
    "Help with Allied AutoTech service bookings, payments, account access and finding our Port Harcourt workshop.",
};
export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container narrow">
          <h1>Help, when you need it.</h1>
          <p className="lead">
            Find your next step, from booking a visit to checking a payment.
          </p>
          <HelpCentre />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
