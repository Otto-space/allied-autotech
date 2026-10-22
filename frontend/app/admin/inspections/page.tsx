import type { Metadata } from "next";
import { StaffInspections } from "@/app/components/staff-inspections";
import "./inspections.css";
export const metadata: Metadata = { title: "Manage vehicle inspections" };
export default function Page() {
  return <StaffInspections />;
}
