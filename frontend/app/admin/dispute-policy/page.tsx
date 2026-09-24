import type { Metadata } from "next";
import { OperationalPolicy } from "@/app/components/operational-policy";
export const metadata: Metadata = { title: "Dispute policy" };
export default function Page() {
  return <OperationalPolicy kind="DISPUTES" />;
}
