import type { Metadata } from "next";
import { cache } from "react";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
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
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  return (
    <ServiceDetail serviceId={serviceId} initialService={await getService(serviceId)} />
  );
}
