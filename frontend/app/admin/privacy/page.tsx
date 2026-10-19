import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkPrivacy } from "@/app/components/work-privacy";
import "../inspections/inspections.css";
import "./privacy.css";
export const metadata: Metadata = { title: "Privacy review" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading privacy review…</p>}>
      <WorkPrivacy />
    </Suspense>
  );
}
