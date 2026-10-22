import type { Metadata } from "next";
import { DisputePolicy } from "@/app/components/dispute-policy";
import "./dispute-policy.css";
export const metadata: Metadata = { title: "Dispute policy" };
export default function Page() {
  return <DisputePolicy />;
}
