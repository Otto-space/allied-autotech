import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { publicData, PublicApiError } from "@/lib/api/public-server";
import { serviceSchema } from "@/lib/api/public-schemas";
import { ServiceDetail } from "../../components/service-detail";
const getService = cache(async (id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    notFound();
  try {
    return await publicData(`/public/services/${id}`, (value) =>
      serviceSchema.parse(value),
    );
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound();
    throw error;
  }
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}): Promise<Metadata> {
  try {
    const service = await getService((await params).serviceId);
    return {
      title: service.name,
      description: (
        service.shortDescription ??
        service.description ??
        `${service.name} at Allied AutoTech in Port Harcourt. View service details and available appointments.`
      ).slice(0, 160),
    };
  } catch {
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
