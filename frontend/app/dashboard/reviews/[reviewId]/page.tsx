import type { Metadata } from "next";
import { CustomerReviewDetail } from "@/app/components/customer-review-detail";
import "../reviews.css";
export const metadata: Metadata = { title: "Review update" };
export default async function Page({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  return <CustomerReviewDetail reviewId={reviewId} />;
}
