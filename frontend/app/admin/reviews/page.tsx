import type { Metadata } from "next";
import { StaffReviews } from "@/app/components/staff-reviews";
export const metadata: Metadata = { title: "Review moderation" };
export default function Page() {
  return <StaffReviews />;
}
