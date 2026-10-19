import type { Metadata } from "next";
import { StaffVehicleSales } from "@/app/components/staff-vehicle-sales";
import "../inspections/inspections.css";
import "./vehicle-sales.css";
export const metadata: Metadata = { title: "Vehicle sales" };
export default function Page() {
  return <StaffVehicleSales />;
}
