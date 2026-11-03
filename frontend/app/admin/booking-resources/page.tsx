import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkshopResources } from "@/app/components/workshop-resources";
import "./booking-resources.css";
export const metadata: Metadata = { title: "Workshop resources" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading workshop resources…</p>}>
      <WorkshopResources />
    </Suspense>
  );
}
