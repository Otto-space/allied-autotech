import type { Metadata } from "next";
import { cache } from "react";
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
import { serviceSchema } from "@/lib/api/public-schemas";
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
      <ServiceDetail serviceId={serviceId} initialService={service} />
    </>
  );
}
