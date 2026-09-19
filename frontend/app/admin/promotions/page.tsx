import type { Metadata } from "next";
import { PromotionList } from "@/app/components/promotion-pages";
export const metadata: Metadata = { title: "Promotions" };
export default function Page() {
  return <PromotionList />;
}
