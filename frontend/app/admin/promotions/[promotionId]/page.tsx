import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PromotionDetail } from "@/app/components/promotion-pages";
export const metadata: Metadata = { title: "Promotion details" };
export default async function Page({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const { promotionId } = await params;
  if (!z.uuid().safeParse(promotionId).success) notFound();
  return <PromotionDetail id={promotionId} />;
}
