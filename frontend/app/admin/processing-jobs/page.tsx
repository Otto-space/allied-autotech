import type { Metadata } from "next";
import { OperationalJobs } from "@/app/components/operational-jobs";
export const metadata: Metadata = { title: "Processing jobs" };
export default function Page() {
  return <OperationalJobs />;
}
