import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffReviews } from "@/app/components/staff-reviews";
import "../inspections/inspections.css";
import "./reviews.css";
export const metadata: Metadata = { title: "Review moderation" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading review moderation…</p>}>
      <StaffReviews />
    </Suspense>
  );
}
