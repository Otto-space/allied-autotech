import type { Metadata } from "next";
import { PromotionCreate } from "@/app/components/promotion-pages";
export const metadata: Metadata = { title: "Create promotion" };
export default function Page() {
  return <PromotionCreate />;
}
