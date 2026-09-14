import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { ServiceList } from "../components/service-list";
export const metadata: Metadata = {
  title: "Vehicle services",
  description:
    "Explore Allied AutoTech vehicle services in Port Harcourt. Review fixed-price appointments or request a quotation for your vehicle.",
};
export default function ServicesPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container">
          <h1>Care for every next kilometre.</h1>
          <p className="lead">
            Explore our published services. See available appointments or discuss a
            quotation with our team.
          </p>
          <ServiceList />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
