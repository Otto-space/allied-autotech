import type { Metadata } from "next";
import { StaffRefunds } from "@/app/components/staff-refunds";
import { Suspense } from "react";
import "../inspections/inspections.css";
import "./refunds.css";
export const metadata: Metadata = { title: "Manage refund requests" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading refund workspace…</p>}>
      <StaffRefunds />
    </Suspense>
  );
}
