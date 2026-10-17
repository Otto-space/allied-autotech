import type { Metadata } from "next";
import { StaffVehicles } from "@/app/components/staff-vehicles";
import "../services/services.css";
import "./vehicle-stock.css";
export const metadata: Metadata = { title: "Vehicle stock" };
export default function Page() {
  return <StaffVehicles />;
}
