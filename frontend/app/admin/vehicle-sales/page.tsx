import type { Metadata } from "next";
import { StaffVehicleSales } from "@/app/components/staff-vehicle-sales";
export const metadata: Metadata = { title: "Vehicle sales" };
export default function Page() {
  return <StaffVehicleSales />;
}
