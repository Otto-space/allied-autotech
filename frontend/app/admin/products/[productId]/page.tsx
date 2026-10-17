import { notFound } from "next/navigation";
import { z } from "zod";
import { WorkProductDetail } from "@/app/components/work-product-detail";
import "../../services/services.css";
import "../../services/[serviceId]/service-detail.css";
import "../products.css";
import "./product-detail.css";

export default async function Page({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  if (!z.uuid().safeParse(productId).success) notFound();
  return <WorkProductDetail productId={productId} />;
}
