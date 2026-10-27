import type { Metadata } from "next";
import { ComplaintPolicy } from "@/app/components/complaint-policy";
import "./complaint-policy.css";
export const metadata: Metadata = { title: "Complaint policy" };
export default function Page() {
  return <ComplaintPolicy />;
}
