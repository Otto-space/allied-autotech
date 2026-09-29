import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseServices } from "@/lib/api/public-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { ServiceList } from "../components/service-list";
import {
  EditorialBanner,
  ServiceJourney,
  ContactInvitation,
} from "../components/brand-editorial";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  const metadata = await publicPageMetadata(
    "Vehicle services",
    "Explore Allied AutoTech vehicle services in Port Harcourt. Review fixed-price appointments or request a quotation for your vehicle.",
    "/services",
    searchParams,
  );
  const seed = await loadPublicSeed("/public/services?limit=12", parseServices);
  return seed.error ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
export default async function ServicesPage() {
  const initial = await loadPublicSeed("/public/services?limit=12", parseServices);
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site">
        <EditorialBanner
          title="Care for every next kilometre."
          description="Explore our published services. See available appointments or discuss a quotation with our team."
        />
        <section className="public-wrap public-section" aria-label="Service catalogue">
          <ServiceList initial={initial} />
        </section>
        <ServiceJourney />
        <ContactInvitation />
      </main>
      <SiteFooter />
    </>
  );
}
