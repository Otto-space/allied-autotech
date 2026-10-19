import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkDisputeHandling } from "@/app/components/work-dispute-handling";
import "./dispute-handling.css";
export const metadata: Metadata = { title: "Dispute work queue" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading dispute workspace…</p>}>
      <WorkDisputeHandling />
    </Suspense>
  );
}
