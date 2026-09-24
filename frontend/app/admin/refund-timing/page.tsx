import type { Metadata } from "next";
import { RefundTimingPolicy } from "@/app/components/refund-timing-policy";
export const metadata: Metadata = { title: "Bank refund timing" };
export default function Page() {
  return <RefundTimingPolicy />;
}
