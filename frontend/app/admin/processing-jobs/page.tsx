import type { Metadata } from "next";
import { OperationalJobs } from "@/app/components/operational-jobs";
import "./processing-jobs.css";
export const metadata: Metadata = { title: "Processing jobs" };
export default function Page() {
  return <OperationalJobs />;
}
