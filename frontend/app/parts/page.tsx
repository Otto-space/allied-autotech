import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { PartsCatalogue } from "../components/parts-catalogue";
export const metadata: Metadata = {
  title: "Shop vehicle parts",
  description:
    "Browse Allied AutoTech parts. Search by name, brand or vehicle compatibility and check availability before collection in Port Harcourt.",
};
export default function PartsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container">
          <h1>The right part. Your next move.</h1>
          <p className="lead">
            Search our current catalogue and review compatibility for your vehicle.
          </p>
          <PartsCatalogue />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
