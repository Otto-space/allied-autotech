import type { Metadata } from "next";
import { StaffRefunds } from "@/app/components/staff-refunds";
export const metadata: Metadata = { title: "Manage refund requests" };
export default function Page() {
  return <StaffRefunds />;
}
