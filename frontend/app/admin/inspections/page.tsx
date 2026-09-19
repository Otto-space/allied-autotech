import type { Metadata } from "next";
import { StaffInspections } from "@/app/components/staff-inspections";
export const metadata: Metadata = { title: "Manage vehicle inspections" };
export default function Page() {
  return <StaffInspections />;
}
