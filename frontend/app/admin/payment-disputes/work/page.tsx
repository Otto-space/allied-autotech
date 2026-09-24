import type { Metadata } from "next";
import { DisputeWorkQueue } from "@/app/components/dispute-work-queue";
export const metadata: Metadata = { title: "Dispute work queue" };
export default function Page() {
  return <DisputeWorkQueue />;
}
