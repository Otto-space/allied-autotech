import { loadPublicSeed } from "@/lib/api/public-seed-server";
import { parseServices } from "@/lib/api/public-schemas";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { ServiceList } from "../components/service-list";
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
      <main id="main">
        <section className="pt-24 pb-16 px-6 max-w-7xl mx-auto">
          <div className="max-w-4xl mb-16">
            <h1 className="public-display-title font-display uppercase text-ink mb-8">
              Care for every <span className="text-brand-red">next kilometre</span>
            </h1>
            <p className="text-xl text-muted max-w-2xl">
              Explore our published services. See available appointments or discuss a
              quotation with our team.
            </p>
          </div>
          <ServiceList initial={initial} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
