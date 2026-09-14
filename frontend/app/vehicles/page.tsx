import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { VehicleCatalogue } from "../components/vehicle-catalogue";
export const metadata: Metadata = {
  title: "Browse vehicles",
  description:
    "Browse current Allied AutoTech vehicle listings in Port Harcourt, compare details and request an inspection.",
};
export default function VehiclesPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container">
          <h1>A new chapter starts here.</h1>
          <p className="lead">
            Browse current vehicle listings, explore the details and arrange a closer
            look.
          </p>
          <VehicleCatalogue />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
