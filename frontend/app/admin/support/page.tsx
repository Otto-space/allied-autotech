import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkSupport } from "@/app/components/work-support";
import "../inspections/inspections.css";
import "./support.css";
export const metadata: Metadata = { title: "Customer care workspace" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading customer care…</p>}>
      <WorkSupport />
    </Suspense>
  );
}
