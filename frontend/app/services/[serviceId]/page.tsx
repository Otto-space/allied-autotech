import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";
import { headers } from "next/headers";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import {
  indexingEnabled,
  siteOrigin,
  serializeStructuredData,
  publicPageMetadata,
  type SearchParameters,
} from "@/lib/seo";
import { publicData, PublicApiError } from "@/lib/api/public-server";
import { serviceSchema, parseServices } from "@/lib/api/public-schemas";
import { formatKobo } from "@/lib/format/money";
import { ServicePhoto } from "../../components/service-photo";
import { ServiceDetail } from "../../components/service-detail";
const getService = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound();
  try {
    return await publicData(`/public/services/${id}`, (value) => {
      const parsed = serviceSchema.parse(value);
      if (parsed.id !== id) throw new PublicApiError(502);
      return parsed;
    });
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound();
    throw error;
  }
});
async function OtherServices({ serviceId }: { serviceId: string }) {
  let services: z.infer<typeof serviceSchema>[] = [];
  let failed = false;
  try {
    services = (await publicData("/public/services?limit=3", parseServices)).items
      .filter((item) => item.id !== serviceId)
      .slice(0, 2);
  } catch (error) {
    unstable_rethrow(error);
    failed = true;
  }
  return (
    <section className="sd-more" id="service-more" aria-labelledby="sd-more-title">
      <div className="sd-container">
        <div className="sd-more-heading">
          <h2 id="sd-more-title">Explore other services</h2>
          <Link className="sd-editorial-link" href="/services">
            Browse services <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        {services.length ? (
          <div className="sd-more-grid">
            {services.map((item) => (
              <Link className="sd-more-item" key={item.id} href={`/services/${item.id}`}>
                <div className="sd-more-media">
                  {item.image ? (
                    <ServicePhoto
                      url={item.image.url}
                      alt={item.image.altText ?? item.name}
                      width={item.image.width}
                      height={item.image.height}
                    />
                  ) : (
                    <Wrench size={26} strokeWidth={1.3} aria-hidden="true" />
                  )}
                </div>
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    {item.durationMinutes !== null && item.durationMinutes > 0
                      ? `${item.durationMinutes} ${item.durationMinutes === 1 ? "minute" : "minutes"}`
                      : "Duration not listed"}
                  </p>
                  <strong>
                    {item.pricingType === "QUOTE_REQUIRED"
                      ? "Quotation required"
                      : item.priceKobo !== null
                        ? formatKobo(item.priceKobo)
                        : "Contact us for pricing"}
                  </strong>
                </div>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="sd-more-empty">
            {failed
              ? "Other services are temporarily unavailable. Browse services or contact our team for help."
              : "No other services are shown right now. Contact our team to discuss your vehicle."}
          </p>
        )}
      </div>
    </section>
  );
}
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: SearchParameters;
}): Promise<Metadata> {
  try {
    const service = await getService((await params).serviceId);
    return publicPageMetadata(
      service.name,
      (
        service.shortDescription ??
        service.description ??
        `${service.name} at Allied AutoTech in Port Harcourt. View service details and available appointments.`
      ).slice(0, 160),
      `/services/${service.id}`,
      searchParams,
    );
  } catch (error) {
    unstable_rethrow(error);
    return { title: "Service details", robots: { index: false } };
  }
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: SearchParameters;
}) {
  const { serviceId } = await params;
  const service = await getService(serviceId);
  const origin = siteOrigin();
  const structured =
    indexingEnabled() && origin && !Object.keys(await searchParams).length
      ? {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Services",
                  item: `${origin}/services`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: service.name,
                  item: `${origin}/services/${service.id}`,
                },
              ],
            },
            {
              "@type": "Service",
              name: service.name,
              url: `${origin}/services/${service.id}`,
              ...(service.description || service.shortDescription
                ? { description: service.description ?? service.shortDescription }
                : {}),
              ...(service.image ? { image: `${origin}${service.image.url}` } : {}),
              provider: { "@type": "AutoRepair", name: "Allied AutoTech", url: origin },
            },
          ],
        }
      : undefined;
  return (
    <>
      {structured && (
        <script
          type="application/ld+json"
          nonce={(await headers()).get("x-nonce") ?? undefined}
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(structured) }}
        />
      )}
      <ServiceDetail
        serviceId={serviceId}
        initialService={service}
        relatedServices={
          <Suspense
            fallback={
              <section className="sd-more" id="service-more">
                <div className="sd-container">
                  <h2>Explore other services</h2>
                  <p role="status">Loading other services…</p>
                </div>
              </section>
            }
          >
            <OtherServices serviceId={service.id} />
          </Suspense>
        }
      />
    </>
  );
}
