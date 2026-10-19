import { notFound } from "next/navigation";
import { z } from "zod";
import { WorkServiceDetail } from "@/app/components/work-service-detail";
import "../services.css";
import "./service-detail.css";

export default async function Page({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  if (!z.uuid().safeParse(serviceId).success) notFound();
  return <WorkServiceDetail serviceId={serviceId} />;
}
