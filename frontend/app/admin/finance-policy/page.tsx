import type { Metadata } from "next";
import { FinancePolicy } from "@/app/components/finance-policy";
export const metadata: Metadata = { title: "Financial policy" };
export default function Page() {
  return <FinancePolicy />;
}
